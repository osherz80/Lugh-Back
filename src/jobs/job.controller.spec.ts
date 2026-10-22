jest.mock('src/db', () => ({ db: {} }));
jest.mock('src/common/helpers/ai', () => ({
  getEmbedding: jest.fn(),
  askAiV2: jest.fn(),
  askAiSeeder: jest.fn(),
  askLocalModel: jest.fn(),
}));

import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JobsController } from './job.controller';
import { JobsService } from './job.service';

describe('JobsController.searchJobs', () => {
  const searchJobs = jest.fn().mockResolvedValue([]);
  let controller: JobsController;

  beforeEach(async () => {
    searchJobs.mockClear();
    const module = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [{ provide: JobsService, useValue: { searchJobs } }],
    }).compile();
    controller = module.get(JobsController);
  });

  it('rejects a blank query', async () => {
    await expect(
      controller.searchJobs({ resource: 'job', query: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(searchJobs).not.toHaveBeenCalled();
  });

  it('rejects a resource other than job or cv', async () => {
    await expect(
      controller.searchJobs({ resource: 'profile', query: 'nurse' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(searchJobs).not.toHaveBeenCalled();
  });

  it('rejects a language that is not a Postgres text search config name', async () => {
    await expect(
      controller.searchJobs({
        resource: 'job',
        query: 'nurse',
        language: 'simple; drop table jobs',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(searchJobs).not.toHaveBeenCalled();
  });

  it('passes structured filters and leaves the query text unchanged', async () => {
    await controller.searchJobs({
      resource: 'job',
      query: '  nurse in tel aviv  ',
      location: 'Tel Aviv',
      workModel: ' Hybrid ',
      experienceLevel: '',
    });

    expect(searchJobs).toHaveBeenCalledWith({
      resource: 'job',
      query: 'nurse in tel aviv',
      location: 'Tel Aviv',
      workModel: 'Hybrid',
      experienceLevel: undefined,
      language: undefined,
    });
  });
});

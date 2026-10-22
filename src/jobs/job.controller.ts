import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { JobsService } from './job.service';
import { JobSearchInput, textSearchConfig } from './job-search';

type SearchBody = {
  resource?: string;
  query?: string;
  location?: string;
  workModel?: string;
  experienceLevel?: string;
  language?: string;
};

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) { }

  @Post('/create')
  async createJob(@Body() body: any) {
    const result = body.method === "manual"
      ? await this.jobsService.createJob(body[body.method])
      : await this.jobsService.autoCreateJob(body[body.method]);
    return result;
  }

  @Post('/search')
  async searchJobs(@Body() body: SearchBody) {
    const query = typeof body?.query === 'string' ? body.query.trim() : '';
    if (!query) {
      throw new BadRequestException('query is required');
    }
    if (body.resource !== 'job' && body.resource !== 'cv') {
      throw new BadRequestException('resource must be "job" or "cv"');
    }

    let language: string | undefined;
    if (typeof body.language === 'string' && body.language.trim()) {
      try {
        language = textSearchConfig(body.language);
      } catch {
        throw new BadRequestException('language must be a Postgres text search configuration name');
      }
    }

    const input: JobSearchInput = {
      resource: body.resource,
      query,
      location: optionalText(body.location),
      workModel: optionalText(body.workModel),
      experienceLevel: optionalText(body.experienceLevel),
      language,
    };
    return this.jobsService.searchJobs(input);
  }
}

function optionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

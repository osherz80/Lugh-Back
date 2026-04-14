import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { JobsService } from './job.service';


@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) { }
  @Post('/create')
  async createJob(@Body() body: any) {
    const result = await this.jobsService.createJob(body.jobDescription, body.jobTitle);
    return result;
  }
  @Post('/search')
  async searchJobs(@Body() body: { jobSearch: string }) {
    const result = await this.jobsService.searchJobs(body.jobSearch);
    return result;
  }
}

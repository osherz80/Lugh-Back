import { Module } from '@nestjs/common';
import { JobsController } from './job.controller';
import { JobsService } from './job.service';
import { RerankerService } from './reranker.service';

@Module({
  controllers: [JobsController],
  providers: [JobsService, RerankerService],
  exports: [JobsService]
})
export class JobsModule { }

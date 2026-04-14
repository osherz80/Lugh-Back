import { Module } from '@nestjs/common';
import { JobsController } from './job.controller';
import { JobsService } from './job.service';

@Module({
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService]
})
export class JobsModule { }

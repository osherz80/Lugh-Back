import { Module } from '@nestjs/common';
import { ParserController } from './parser.controller';

@Module({
  controllers: [ParserController]
})
export class ParserModule {}

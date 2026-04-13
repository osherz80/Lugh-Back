import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { askAi } from '../common/helpers/ai';
import { ParserSchema } from './parser.schema';

@Controller('parser')
export class ParserController {
  @Post()
  async getAiResponse(@Body() body: any) {
    const parseResult = ParserSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error.issues[0].message);
    }
    const { prompt } = parseResult.data;
    console.log(prompt);
    const aiResult = await askAi(prompt);
    return { result: aiResult };
  }
}
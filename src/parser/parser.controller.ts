import { Controller, Post, Body } from '@nestjs/common';
import { askAi } from '../common/helpers/ai';

@Controller('parser')
export class ParserController {
  @Post()
  async getAiResponse(@Body('prompt') prompt: string) {
    if (!prompt) {
      return { error: 'Prompt is required' };
    }
    const result = await askAi(prompt);
    return { result };
  }
}

import { z } from 'zod';

export const ParserSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required and cannot be empty'),
});

export type ParserDto = z.infer<typeof ParserSchema>;

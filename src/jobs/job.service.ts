import { Injectable } from '@nestjs/common';
import { getEmbedding } from 'src/common/helpers/ai';
import { db } from 'src/db';
import { jobs } from 'src/db/schema';

@Injectable()
export class JobsService {
  async createJob(jobDescription: string, jobTitle: string) {
    if (!jobDescription || !jobTitle) {
      throw new Error('Job description and job title are required');
    }

    try {
      let embedding = await getEmbedding(jobDescription);
      embedding = embedding.slice(0, 256);
      const result = await db.insert(jobs).values({
        title: jobTitle,
        description: jobDescription,
        embedding: embedding,
      });
      return result;
    } catch (err) {
      console.log(err);
    }
  }
}

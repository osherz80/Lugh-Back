import { Injectable } from '@nestjs/common';
import { desc, sql } from 'drizzle-orm';
import { getEmbedding } from 'src/common/helpers/ai';
import { db } from 'src/db';
import { jobs } from 'src/db/schema';
import { Job } from 'src/common/types/general';

@Injectable()
export class JobsService {
  async createJob(job: Job) {
    if (!job) {
      throw new Error('Job is required');
    }
    console.log('job: ', job)
    try {
      let embedding = await getEmbedding(job.description);
      console.log('embedding: ', embedding)
      embedding = embedding.slice(0, 256);
      const result = await db.insert(jobs).values({
        ...job,
      });
      return result;
    } catch (err) {
      console.log(err);
    }
  }

  async autoCreateJob(job: Job) {
    if (!job) {
      throw new Error('Job is required');
    }

    try {
      let embedding = await getEmbedding(job.description);
      embedding = embedding.slice(0, 256);
      const result = await db.insert(jobs).values({
        ...job,
      });
      return result;
    } catch (err) {
      console.log(err);
    }
  }

  async searchJobs(jobSearch: string) {
    if (!jobSearch) {
      throw new Error('Search job is required');
    }
    try {
      let embeddedQuery = await getEmbedding(jobSearch);
      embeddedQuery = embeddedQuery.slice(0, 256);

      const similarity = sql<number>`1 - (${jobs.embedding} <=> ${JSON.stringify(embeddedQuery)})`;

      const results = await db
        .select({
          id: jobs.id,
          title: jobs.title,
          description: jobs.description,
          score: similarity,
        })
        .from(jobs)
        .where(sql`${similarity} > 0.1`)
        .orderBy(t => desc(t.score))
        .limit(10);

      return results;
    } catch (err) {
      console.log(err);
    }
  }
}

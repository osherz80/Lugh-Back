import { Injectable } from '@nestjs/common';
import { desc, sql } from 'drizzle-orm';
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

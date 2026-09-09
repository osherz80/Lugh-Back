import { Injectable } from '@nestjs/common';
import { desc, sql } from 'drizzle-orm';
import { askAiV2, getEmbedding } from 'src/common/helpers/ai';
import { db } from 'src/db';
import { jobs } from 'src/db/schema';
import { Job } from 'src/common/types/general';
import { JOB_POST_EXTRACTOR } from 'src/common/prompts/jobs';

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
      const result = await db.insert(jobs).values({
        ...job,
        embedding
      });
      return result;
    } catch (err) {
      console.log(err);
    }
  }

  async autoCreateJob(job: { description: string }) {
    if (!job) {
      throw new Error('Job is required');
    }

    const jobSchema = {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        description: { type: 'STRING' },
        responsibilities: { type: 'STRING' },
        requirements: { type: 'STRING' },
        niceToHave: { type: 'STRING' },
        benefits: { type: 'STRING' },
        aboutCompany: { type: 'STRING' },
        department: { type: 'STRING' },
        location: { type: 'STRING' },
        workModel: { type: 'STRING' },
        employmentType: { type: 'STRING' },
        experienceLevel: { type: 'STRING' },
      },
      required: [
        'title',
        'description',
        'responsibilities',
        'requirements',
        'niceToHave',
        'benefits',
        'aboutCompany',
        'department',
        'location',
        'workModel',
        'employmentType',
        'experienceLevel',
      ]
    };

    try {
      let embedding = await getEmbedding(`${job.description}`);
      const structuredJob = await askAiV2<Job>(JOB_POST_EXTRACTOR, `here is the [JOB_POST]: ${job.description}`, 0.3, jobSchema)
      const result = await db.insert(jobs).values({
        ...structuredJob,
        embedding
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

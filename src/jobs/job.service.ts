import { Injectable } from '@nestjs/common';
import { desc, sql } from 'drizzle-orm';
import { askAiV2, getEmbedding } from 'src/common/helpers/ai';
import { db } from 'src/db';
import { documentChunks, jobs } from 'src/db/schema';
import { Job, Chunk } from 'src/common/types/general';
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
      const [createdJob] = await db.insert(jobs).values({
        ...job,
        embedding
      }).returning();

      await this.chunkEmbedInsert(createdJob)

      return createdJob;
    } catch (err) {
      console.log(err);
      return err
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
      const [createdJob] = await db.insert(jobs).values({
        ...structuredJob,
        embedding
      }).returning();

      await this.chunkEmbedInsert(createdJob)

      return createdJob;
    } catch (err) {
      console.log(err);
      return err
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
      return err
    }
  }

  async chunkAndEmbed(job: Job) {
    const { id, createdAt, updatedAt, embedding, ...clearJob } = job
    try {
      console.log("embedding job chunks")
      return await Promise.all(
        Object.keys(clearJob).map(async (key) => {
          const embedding = await getEmbedding(clearJob[key])
          return {
            jobId: job.id,
            embedding,
            chunkText: clearJob[key],
            section: key,
            chunkIndex: 0,
            sourceType: 'job'
          }
        }))
    } catch (err) {
      console.log("error embedding job chunks")
      return err
    }
  }

  async inserJobChunks(chunks: Chunk[]) {
    try {
      console.log("inserting job chunks")
      return await db.insert(documentChunks).values(chunks)
    } catch (err) {
      console.log("error inserting job chunks", err)
      return err
    }
  }

  async chunkEmbedInsert(job: Job) {
    const chunks = await this.chunkAndEmbed(job)
    return await this.inserJobChunks(chunks)
  }
}
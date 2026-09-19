import { Injectable } from '@nestjs/common';
import { desc, eq, sql, and } from 'drizzle-orm';
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

  async searchJobs(resource: "job" | "cv", query: string) {
    if (!query) {
      throw new Error('Search query is required');
    }

    try {
      const hydePrpt = `you are a job to candidate matcher, your role is to help our candidates with their job search.
    our candidate dont know how to search correctly in our app and use vague search terms,
    your job is to take their query and generate a hypotethical answer that will match 
    what job they tried to find.`;

      const hyde = await askAiV2<string>(hydePrpt, `here is the user query: ${query}`, 0.3);
      console.log('hyde: ', hyde)
      const embeddedQuery = await getEmbedding(`${hyde}`);

      const similarity = sql<number>`1 - (${documentChunks.embedding} <=> ${JSON.stringify(embeddedQuery)})`;

      const rankedChunks = db.$with('ranked_chunks').as(
        db
          .select({
            jobId: documentChunks.jobId,
            chunkScore: similarity.as('chunk_score'),
            rank: sql<number>`ROW_NUMBER() OVER (
            PARTITION BY ${documentChunks.jobId} 
            ORDER BY 1 - (${documentChunks.embedding} <=> ${JSON.stringify(embeddedQuery)}) DESC
          )`.as('rank'),
          })
          .from(documentChunks)
          .where(
            and(
              eq(documentChunks.sourceType, resource),
              sql`${similarity} > 0.1`
            )
          )
      );

      const results = await db
        .with(rankedChunks)
        .select({
          jobId: rankedChunks.jobId,
          score: sql<number>`AVG(${rankedChunks.chunkScore})`.as('score'),
        })
        .from(rankedChunks)
        .where(sql`${rankedChunks.rank} <= 3`)
        .groupBy(rankedChunks.jobId)
        .orderBy(desc(sql`AVG(${rankedChunks.chunkScore})`))
        .limit(100);

      const jobsFound = await db.query.jobs.findMany({
        where: eq(jobs.id, results.map((result) => result.jobId)),

      });
      console.log('jobs found: ', jobsFound)

    } catch (err) {
      console.error('Error during job search:', err);
      throw err;
    }
  }

  async chunkAndEmbed(job: Job) {
    const { id, createdAt, updatedAt, embedding, salaryRange, ...clearJob } = job
    try {
      console.log("embedding job chunks")
      return await Promise.all(
        Object.keys(clearJob).map(async (key) => {
          // console.log(`chunk key: ${key}\n chunk content: ${clearJob[key]}`)
          if (!clearJob[key]) return;
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
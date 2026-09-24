import { Injectable } from '@nestjs/common';
import { desc, eq, sql, and, inArray } from 'drizzle-orm';
import { askAiV2, getEmbedding } from 'src/common/helpers/ai';
import { db } from 'src/db';
import { documentChunks, jobs } from 'src/db/schema';
import { Job, Chunk } from 'src/common/types/general';
import { JOB_POST_EXTRACTOR } from 'src/common/prompts/jobs';
import { RerankerService } from './reranker.service';

@Injectable()
export class JobsService {
  constructor(
    private readonly rerankerService: RerankerService) {
  }
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

  async rechunk() {
    const chunks = await db.select().from(documentChunks);
    for (const c of chunks) {
      const embedding = await getEmbedding(c.chunkText);
      await db.update(documentChunks).set({ embedding }).where(eq(documentChunks.id, c.id));
    }
    const allJobs = await db.select().from(jobs);
    for (const j of allJobs) {
      const embedding = await getEmbedding(j.description);
      await db.update(jobs).set({ embedding }).where(eq(jobs.id, j.id));
    }
    console.log('re-embedded all chunks and jobs');
  }

  async reweightChunks() {
    const FIELD_WEIGHTS: Record<string, number> = {
      title: 2.2,
      requirements: 1.8,
      responsibilities: 1.0,
      aboutCompany: 0.3,
    };
    const DEFAULT_WEIGHT = 1.0;
    const chunks = await db.select().from(documentChunks)
    console.log('reweighjting')
    for (const chunk of chunks) {
      let w = DEFAULT_WEIGHT
      if (chunk.section === 'title') w = DEFAULT_WEIGHT || FIELD_WEIGHTS.title
      if (chunk.section === 'requirements') w = DEFAULT_WEIGHT || FIELD_WEIGHTS.requirements
      if (chunk.section === 'responsibilities') w = DEFAULT_WEIGHT || FIELD_WEIGHTS.responsibilities
      if (chunk.section === 'aboutCompany') w = DEFAULT_WEIGHT || FIELD_WEIGHTS.aboutCompany
      await db.update(documentChunks).set({ weight: w }).where(eq(documentChunks.id, chunk.id));
    }
    console.log('re-weighted all chunks');
  }

  async executeJobSearch(query: string) {
    // Step 1: Candidate Generation (SQL Pre-filter + Field-Weighted Vector Search)
    // Pulls top 30 candidate records using MAX() chunk scoring
    const candidatePool = await this.searchJobsV2('job', query);

    if (candidatePool.length === 0) {
      return [];
    }

    // Step 2: Post-Retrieval Cross-Encoder Reranking
    // Reranks top 30 candidates down to top 10 razor-sharp matches
    const finalResults = await this.rerankerService.rerankJobs(
      query,
      candidatePool,
      10,   // Return top 10
      0.35, // Drop any candidate scoring below 35% confidence
    );

    return finalResults;
  }

  async searchJobs(resource: "job" | "cv", query: string) {
    if (!query) {
      throw new Error('Search query is required');
    }

    // await this.rechunk()
    // await this.reweightChunks();
    // return;

    const hydeScheme = {
      type: 'OBJECT',
      properties: {
        jobDescription: { type: 'STRING' },
        title: { type: 'STRING' }
      },
      required: ['jobDescription', 'title']
    }

    try {
      const hydePrpt = `you are a job to candidate matcher, your role is to help our candidates with their job search.
    our candidate dont know how to search correctly in our app and use vague search terms,
    your job is to take their query and generate a hypotethical answer that will match 
    what job they tried to find.
    your answer should be only a short job description nothing more.`;

      const hyde = await askAiV2<{ jobDescription: string, title: string }>(hydePrpt, `here is the user query: ${query}`, 0.3, hydeScheme);
      console.log('hyde: ', hyde)
      const embeddedQuery = await getEmbedding(`${hyde.jobDescription} ${hyde.title}`);
      console.log('embeddedQuery len: ', embeddedQuery.length)

      // const similarity = sql<number>`1 - (${documentChunks.embedding} <=> ${JSON.stringify(embeddedQuery)})`;

      const similarity = sql<number>`(1 - (${documentChunks.embedding} <=> ${JSON.stringify(embeddedQuery)})) * ${documentChunks.weight}`;

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

      const results = await db // TODO: add field weights, eg' title *2, requirements *1.5, etc'
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

      const jobIds = results
        .map((result) => result.jobId)
        .filter((id): id is string => Boolean(id));

      if (jobIds.length === 0) {
        return [];
      }

      const jobsFound = await db.query.jobs.findMany({
        where: inArray(jobs.id, jobIds),
      });

      const scoreMap = new Map(results.map((result) => [result.jobId, result.score]));
      const sortedJobs = jobsFound
        .map((job) => ({
          ...job,
          score: scoreMap.get(job.id) ?? 0,
        }))
        .sort((a, b) => b.score - a.score);

      return sortedJobs;

    } catch (err) {
      console.error('Error during job search:', err);
      throw err;
    }
  }

  async searchJobsV2(resource: 'job' | 'cv', query: string) {
    if (!query) {
      throw new Error('Search query is required');
    }

    // 1. HyDE Query Expansion
    const hydeScheme = {
      type: 'OBJECT',
      properties: {
        jobDescription: { type: 'STRING' },
        title: { type: 'STRING' },
      },
      required: ['jobDescription', 'title'],
    };

    try {
      const hydePrompt = `you are a job to candidate matcher, your role is to help our candidates with their job search.
our candidate dont know how to search correctly in our app and use vague search terms,
your job is to take their query and generate a hypotethical answer that will match 
what job they tried to find.
your answer should be only a short job description nothing more.`;

      const hyde = await askAiV2<{ jobDescription: string; title: string }>(
        hydePrompt,
        `here is the user query: ${query}`,
        0.3,
        hydeScheme,
      );

      const embeddedQuery = await getEmbedding(
        `${hyde.jobDescription} ${hyde.title}`,
      );

      // 2. Compute Raw Cosine Similarity (0.0 to 1.0)
      const rawSimilarity = sql<number>`(1 - (${documentChunks.embedding} <=> ${JSON.stringify(embeddedQuery)}))`;

      // 3. Apply Normalized Field Weights (Sum = 1.0)
      // Adjust 'chunkType' column name if your schema uses a different field name (e.g. 'field', 'category')
      const weightedSimilarity = sql<number>`
  ${rawSimilarity} * CASE ${documentChunks.section}
    WHEN 'title' THEN 0.40
    WHEN 'requirements' THEN 0.25
    WHEN 'responsibilities' THEN 0.15
    WHEN 'nice_to_have' THEN 0.10
    WHEN 'description' THEN 0.05
    WHEN 'about_company' THEN 0.05
    ELSE 0.10
  END
`;

      // 4. CTE: Filter out low raw similarity scores first
      const weightedChunks = db.$with('weighted_chunks').as(
        db
          .select({
            jobId: documentChunks.jobId,
            weightedScore: weightedSimilarity.as('weighted_score'),
          })
          .from(documentChunks)
          .where(
            and(
              eq(documentChunks.sourceType, resource),
              sql`${rawSimilarity} > 0.15`, // Hard threshold to remove noise before aggregation
            ),
          ),
      );

      // 5. Aggregate by MAX() score per job instead of AVG()
      // Prevents weak boilerplate chunks from diluting a strong title/requirements match
      const results = await db
        .with(weightedChunks)
        .select({
          jobId: weightedChunks.jobId,
          score: sql<number>`MAX(${weightedChunks.weightedScore})`.as('score'),
        })
        .from(weightedChunks)
        .groupBy(weightedChunks.jobId)
        .orderBy(desc(sql`MAX(${weightedChunks.weightedScore})`))
        .limit(30); // Fetch top 30 candidate pool for Cross-Encoder reranking

      const jobIds = results
        .map((result) => result.jobId)
        .filter((id): id is string => Boolean(id));

      if (jobIds.length === 0) {
        return [];
      }

      // 6. Fetch Full Job Objects for the candidate set
      const jobsFound = await db.query.jobs.findMany({
        where: inArray(jobs.id, jobIds),
      });

      // 7. Preserve Exact Ranking Order
      const scoreMap = new Map(
        results.map((result) => [result.jobId, result.score]),
      );

      const topCandidates = jobsFound
        .map((job) => ({
          ...job,
          retrievalScore: Number(
            (scoreMap.get(job.id) ?? 0).toFixed(6),
          ),
        }))
        .sort((a, b) => b.retrievalScore - a.retrievalScore);
      for (const job of topCandidates.slice(0, 10)) {
        console.log(`\ntitle: ${job.title}\n score: ${job.retrievalScore}`)
      }
      // console.log('topCandidates: ', topCandidates.slice(0, 10))

      return topCandidates;
    } catch (err) {
      console.log("error during job search", err)
      throw err;
    }
  }

  async chunkAndEmbed(job: Job) {
    const FIELD_WEIGHTS: Record<string, number> = {
      title: 2.2,
      requirements: 1.8,
      responsibilities: 1.0,
      aboutCompany: 0.3,
    };
    const DEFAULT_WEIGHT = 1.0;
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
            sourceType: 'job',
            weight: FIELD_WEIGHTS[key] || DEFAULT_WEIGHT,
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
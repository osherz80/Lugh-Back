import { BadRequestException, Injectable } from '@nestjs/common';
import { desc, eq, sql, and, inArray, SQL } from 'drizzle-orm';
import { askAiSeeder, askAiV2, askLocalModel, getEmbedding } from 'src/common/helpers/ai';
import { db } from 'src/db';
import { cvs, documentChunks, jobs } from 'src/db/schema';
import { Job, Chunk } from 'src/common/types/general';
import { JOB_POST_CREATOR, JOB_POST_EXTRACTOR } from 'src/common/prompts/jobs';
import { RerankerService } from './reranker.service';
import {
  JobSearchFilters,
  JobSearchInput,
  KEYWORD_CANDIDATE_LIMIT,
  RAW_COSINE_FLOOR,
  VECTOR_CANDIDATE_LIMIT,
  buildSearchPool,
  capByRerankFloor,
  hasSearchFilters,
  searchFilters,
  sectionWeight,
  shouldRunHyde,
  textSearchConfig,
  tierRankedJobs,
  titleMatchesQuery,
} from './job-search';

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
      const [createdJob] = await db.insert(jobs).values({
        ...job,
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
      const structuredJob = await askAiV2<Job>(JOB_POST_EXTRACTOR, `here is the [JOB_POST]: ${job.description}`, 0.3, jobSchema)
      const [createdJob] = await db.insert(jobs).values({
        ...structuredJob,
      }).returning();

      await this.chunkEmbedInsert(createdJob)

      return createdJob;
    } catch (err) {
      console.log(err);
      return err
    }
  }

  async seeder() {
    // const jobSchema = {
    //   type: "object",
    //   properties: {
    //     title: { type: "string" },
    //     description: { type: "string" },
    //     responsibilities: { type: "string" },
    //     requirements: { type: "string" },
    //     niceToHave: { type: "string" },
    //     benefits: { type: "string" },
    //     aboutCompany: { type: "string" },
    //     department: { type: "string" },
    //     location: { type: "string" },
    //     workModel: { type: "string" },
    //     employmentType: { type: "string" },
    //     experienceLevel: { type: "string" },
    //   },
    //   required: [
    //     "title",
    //     "description",
    //     "responsibilities",
    //     "requirements",
    //     "niceToHave",
    //     "benefits",
    //     "aboutCompany",
    //     "department",
    //     "location",
    //     "workModel",
    //     "employmentType",
    //     "experienceLevel",
    //   ],
    // };
    const jobSchema = {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        description: { type: 'STRING' },
        responsibilities: { type: 'STRING' },
        requirements: { type: 'STRING' },
        niceToHave: { type: 'STRING' },
        benefits: { type: 'STRING' },
        company: { type: 'STRING' },
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
        'company',
        'aboutCompany',
        'department',
        'location',
        'workModel',
        'employmentType',
        'experienceLevel',
      ]
    };
    const providedTitles: string[] = []
    let itr = 1
    console.log('jobbing', itr)
    while (itr <= 10000) {
      try {
        const titlesToAdd = providedTitles.length > 500 ? providedTitles.slice(providedTitles.length - 500, providedTitles.length) : providedTitles
        const titles = "your last provided jobs were: " + titlesToAdd.join(', ') + ". DO NOT repeat those jobs and provide another differnt job"
        const structuredJob = await askAiSeeder<Job>(`${JOB_POST_CREATOR}`, titles, 0.8, jobSchema)
        console.log(itr, `${structuredJob.title} in ${structuredJob.company} at ${structuredJob.location}`)
        const [createdJob] = await db.insert(jobs).values({
          ...structuredJob,
        }).returning();

        await this.chunkEmbedInsert(createdJob)
        console.log('chunks embedded')
        providedTitles.push(`${structuredJob.title} in ${structuredJob.company} at ${structuredJob.location}`)
        itr++
      } catch (err) {
        console.log(err);
      }
    }
    return true
  }


  async rechunk() {
    const chunks = await db.select().from(documentChunks);
    for (const c of chunks) {
      const embedding = await getEmbedding(c.chunkText);
      await db.update(documentChunks).set({ embedding }).where(eq(documentChunks.id, c.id));
    }

    console.log('re-embedded all chunks');
  }

  async reweightChunks() {
    await db.execute(sql`
      UPDATE document_chunks
      SET weight = CASE section
        WHEN 'title' THEN ${sectionWeight('title')}
        WHEN 'requirements' THEN ${sectionWeight('requirements')}
        WHEN 'niceToHave' THEN ${sectionWeight('niceToHave')}
        WHEN 'responsibilities' THEN ${sectionWeight('responsibilities')}
        WHEN 'description' THEN ${sectionWeight('description')}
        WHEN 'aboutCompany' THEN ${sectionWeight('aboutCompany')}
        ELSE ${sectionWeight('other')}
      END
    `);
  }

  async searchJobs(input: JobSearchInput) {
    const query = input.query?.trim() ?? '';
    if (!query) {
      throw new BadRequestException('query is required');
    }
    if (input.resource !== 'job' && input.resource !== 'cv') {
      throw new BadRequestException('resource must be "job" or "cv"');
    }
    if (input.resource === 'cv') {
      return this.searchCvs(query);
    }

    const filters = searchFilters(input);
    const titles = await this.jobTitles(filters);
    if (hasSearchFilters(filters) && titles.length === 0) {
      return [];
    }

    const textToEmbed = shouldRunHyde(query, titles.map((row) => row.title))
      ? await this.hypotheticalJobText(query)
      : query;
    const embeddedQuery = await getEmbedding(textToEmbed, 'RETRIEVAL_QUERY');
    const filteredIds = hasSearchFilters(filters) ? titles.map((row) => row.id) : undefined;
    const [vectorHits, keywordHits] = await Promise.all([
      this.vectorHits('job', embeddedQuery, filteredIds),
      this.keywordJobHits(query, input.language, filters),
    ]);

    const titleHitIds = titles
      .filter((row) => titleMatchesQuery(row.title, query))
      .map((row) => row.id);
    const poolIds = buildSearchPool(vectorHits, keywordHits, titleHitIds);
    if (poolIds.length === 0) {
      return [];
    }

    const found = await db.query.jobs.findMany({
      where: inArray(jobs.id, poolIds),
    });
    const scoreById = new Map(vectorHits.map((hit) => [hit.id, hit.score]));
    const jobsById = new Map(found.map((job) => [job.id, job]));
    const candidates = poolIds.flatMap((id) => {
      const job = jobsById.get(id);
      if (!job) return [];
      return [{ ...job, score: scoreById.get(id) ?? 0 }];
    });

    const reranked = await this.rerankerService.rerankJobs(query, candidates);
    const returnedIds = new Set(reranked.map((job) => job.id));
    const withScores = [
      ...reranked,
      ...candidates
        .filter((job) => !returnedIds.has(job.id))
        .map((job) => ({
          ...job,
          vectorScore: job.score,
          rerankScore: 0,
        })),
    ];

    return tierRankedJobs(withScores, new Set(titleHitIds)).map((job) => ({
      ...job,
      score: job.rerankScore,
    }));
  }

  private async searchCvs(query: string) {
    const embeddedQuery = await getEmbedding(query, 'RETRIEVAL_QUERY');
    const hits = await this.vectorHits('cv', embeddedQuery);
    if (hits.length === 0) {
      return [];
    }

    const found = await db.query.cvs.findMany({
      where: inArray(cvs.id, hits.map((hit) => hit.id)),
    });
    const scoreById = new Map(hits.map((hit) => [hit.id, hit.score]));
    const candidates = found
      .map((cv) => ({ ...cv, score: scoreById.get(cv.id) ?? 0 }))
      .sort((left, right) => right.score - left.score);
    const reranked = await this.rerankerService.rerankCvs(query, candidates);

    return capByRerankFloor(reranked).map((cv) => ({
      ...cv,
      score: cv.rerankScore,
    }));
  }

  private async hypotheticalJobText(query: string) {
    const hydeScheme = {
      type: 'OBJECT',
      properties: {
        jobDescription: { type: 'STRING' },
        title: { type: 'STRING' },
      },
      required: ['jobDescription', 'title'],
    };
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
    return `${hyde.jobDescription} ${hyde.title}`;
  }

  private async jobTitles(filters: JobSearchFilters) {
    const conditions = this.jobFilterConditions(filters);
    const query = db.select({ id: jobs.id, title: jobs.title }).from(jobs);
    if (conditions.length === 0) return query;
    return query.where(and(...conditions));
  }

  private jobFilterConditions(filters: JobSearchFilters): SQL[] {
    const conditions: SQL[] = [];
    if (filters.location) {
      conditions.push(sql`lower(${jobs.location}) = ${filters.location.toLowerCase()}`);
    }
    if (filters.workModel) {
      conditions.push(sql`lower(${jobs.workModel}) = ${filters.workModel.toLowerCase()}`);
    }
    if (filters.experienceLevel) {
      conditions.push(sql`lower(${jobs.experienceLevel}) = ${filters.experienceLevel.toLowerCase()}`);
    }
    return conditions;
  }

  private async keywordJobHits(query: string, language: string | undefined, filters: JobSearchFilters) {
    const config = textSearchConfig(language);
    const regconfig = () => sql.raw(`'${config}'`);
    const document = () => sql`to_tsvector(${regconfig()}, ${jobs.title} || ' ' || coalesce(${jobs.requirements}, ''))`;
    const lexemes = () => sql`(
      SELECT string_agg(quote_literal(lexeme), ' | ')
      FROM unnest(to_tsvector(${regconfig()}, ${query}))
    )`;
    const tsq = () => sql`to_tsquery(${regconfig()}, ${lexemes()})`;
    const rows = await db
      .select({
        id: jobs.id,
        rank: sql<number>`ts_rank(${document()}, ${tsq()})`.as('rank'),
      })
      .from(jobs)
      .where(and(
        sql`${lexemes()} IS NOT NULL`,
        sql`${document()} @@ ${tsq()}`,
        ...this.jobFilterConditions(filters),
      ))
      .orderBy(desc(sql`ts_rank(${document()}, ${tsq()})`))
      .limit(KEYWORD_CANDIDATE_LIMIT);

    return rows.map((row) => ({ id: row.id, rank: Number(row.rank) }));
  }

  private async vectorHits(resource: 'job' | 'cv', embeddedQuery: number[], jobIds?: string[]) {
    const embedded = JSON.stringify(embeddedQuery);
    const rawCosine = () => sql`1 - (${documentChunks.embedding} <=> ${embedded})`;
    const idColumn = resource === 'job' ? documentChunks.jobId : documentChunks.cvId;
    const conditions: SQL[] = [
      eq(documentChunks.sourceType, resource),
      sql`${rawCosine()} > ${RAW_COSINE_FLOOR}`,
      sql`${idColumn} IS NOT NULL`,
    ];
    if (jobIds) {
      conditions.push(inArray(documentChunks.jobId, jobIds));
    }

    const rows = await db
      .select({
        id: idColumn,
        score: sql<number>`MAX(${rawCosine()} * ${documentChunks.weight})`.as('score'),
      })
      .from(documentChunks)
      .where(and(...conditions))
      .groupBy(idColumn)
      .orderBy(desc(sql`MAX(${rawCosine()} * ${documentChunks.weight})`))
      .limit(VECTOR_CANDIDATE_LIMIT);

    return rows.flatMap((row) => (row.id ? [{ id: row.id, score: Number(row.score) }] : []));
  }

  async chunkAndEmbed(job: Job) {
    const { id, createdAt, updatedAt, salaryRange, ...clearJob } = job
    try {
      console.log("embedding job chunks")
      return await Promise.all(
        Object.keys(clearJob).map(async (key) => {
          // console.log(`chunk key: ${key}\n chunk content: ${clearJob[key]}`)
          if (!clearJob[key]) return;
          const embedding = await getEmbedding(clearJob[key])
          return {
            jobId: job.id,
            chunkText: clearJob[key],
            section: key,
            embedding,
            chunkIndex: 0,
            sourceType: 'job',
            weight: sectionWeight(key),
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
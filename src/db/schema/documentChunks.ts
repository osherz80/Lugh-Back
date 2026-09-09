import { index, integer, pgTable, text, timestamp, uuid, vector, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { jobs } from './jobs';
import { cvs } from './cvs';

export const CHUNK_SOURCE_TYPES = ['job', 'cv'] as const;
export type ChunkSourceType = (typeof CHUNK_SOURCE_TYPES)[number];

export const documentChunks = pgTable('document_chunks', {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceType: text('source_type', { enum: CHUNK_SOURCE_TYPES }).notNull(),

    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }),
    cvId: uuid('cv_id').references(() => cvs.id, { onDelete: 'cascade' }),

    chunkText: text('chunk_text').notNull(),
    embedding: vector('embedding', { dimensions: 256 }).notNull(),
    section: text('section').notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
    chunkEmbeddingIdx: index('chunk_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
    jobChunkIdx: index('job_chunk_idx').on(table.jobId),
    cvChunkIdx: index('cv_chunk_idx').on(table.cvId),
    chunkSrcExclusive: check('chunk_src_exclusive', sql`(job_id IS NOT NULL) <> (cv_id IS NOT NULL)`),
}));
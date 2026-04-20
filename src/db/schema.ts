import { pgTable, uuid, text, vector, index } from 'drizzle-orm/pg-core';

export const candidates = pgTable('candidates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  cvText: text('cv_text'),
  embedding: vector('embedding', { dimensions: 256 }),
}, (table) => {
  return {
    candidateEmbeddingIdx: index('candidate_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
  };
});

export const jobs = pgTable('jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  embedding: vector('embedding', { dimensions: 256 }),
}, (table) => {
  return {
    jobEmbeddingIdx: index('job_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
  };
});
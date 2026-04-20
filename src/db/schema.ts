import { pgTable, uuid, text, vector, index, timestamp } from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username'),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  profilePicture: text('profilePicture'),
  refreshTokens: text('refreshTokens').array().default([]),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
});

export const candidates = pgTable('candidates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
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
import { pgTable, uuid, text, vector, index, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
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
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  embedding: vector('embedding', { dimensions: 256 }),
}, (table) => {
  return {
    candidateEmbeddingIdx: index('candidate_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
  };
});

export const usersRelations = relations(users, ({ one }) => ({
  candidate: one(candidates, {
    fields: [users.id],
    references: [candidates.userId],
  }),
}));

export const candidatesRelations = relations(candidates, ({ one }) => ({
  user: one(users, {
    fields: [candidates.userId],
    references: [users.id],
  }),
}));

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
import { pgTable, uuid, text, vector, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const candidates = pgTable('candidates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  embedding: vector('embedding', { dimensions: 512 }),
}, (table) => {
  return {
    candidateEmbeddingIdx: index('candidate_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
  };
});

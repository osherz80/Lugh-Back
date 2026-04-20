import { pgTable, uuid, text, vector, index } from 'drizzle-orm/pg-core';

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
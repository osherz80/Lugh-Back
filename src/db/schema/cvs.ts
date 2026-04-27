import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, vector, index, timestamp } from 'drizzle-orm/pg-core';
import { candidates } from '../schema';

export const cvs = pgTable('cvs', {
    id: uuid('id').defaultRandom().primaryKey(),
    candidateId: uuid('candidate_id')
        .notNull()
        .references(() => candidates.userId, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: 256 }),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => {
    return {
        cvEmbeddingIdx: index('cv_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
    };
});


export const cvsRelations = relations(cvs, ({ one }) => ({
    candidate: one(candidates, {
        fields: [cvs.candidateId],
        references: [candidates.userId],
    }),
}));
import { pgTable, uuid, text, vector, index, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

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

export const candidatesRelations = relations(candidates, ({ one }) => ({
    user: one(users, {
        fields: [candidates.userId],
        references: [users.id],
    }),
}));
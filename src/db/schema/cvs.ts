import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, vector, index, timestamp, boolean, integer } from 'drizzle-orm/pg-core';
import { candidates } from '../schema';

export const cvs = pgTable('cvs', {
    id: uuid('id').defaultRandom().primaryKey(),
    candidateId: uuid('candidate_id')
        .notNull()
        .references(() => candidates.userId, { onDelete: 'cascade' }),

    // File Management
    fileName: text('file_name').notNull(),
    fileUrl: text('file_url'),
    isMaster: boolean('is_master').default(false).notNull(),
    roleTag: text('role_tag'),

    // Content Layers
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: 256 }),// TODO: add chunking(ColBERT)

    // Metrics
    overallScore: integer('overall_score').default(0),
    atsScore: integer('ats_score').default(0),
    keywordsScore: integer('keywords_score').default(0),
    impactScore: integer('impact_score').default(0),
    layoutScore: integer('layout_score').default(0),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => {
    return {
        cvEmbeddingIdx: index('cv_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
        candidateIdx: index('candidate_idx').on(table.candidateId),
    };
});


export const cvsRelations = relations(cvs, ({ one }) => ({
    candidate: one(candidates, {
        fields: [cvs.candidateId],
        references: [candidates.userId],
    }),
}));
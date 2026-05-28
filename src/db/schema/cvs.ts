import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, vector, index, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';
import { CVTip } from 'src/cvs/types/cv';
import { smartProfiles } from './index';

export const cvs = pgTable('cvs', {
    id: uuid('id').defaultRandom().primaryKey(),
    profileId: uuid('profile_id')
        .notNull()
        .references(() => smartProfiles.profileId, { onDelete: 'cascade' }),

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
    tips: jsonb('tips').$type<CVTip[]>().default([]).notNull(),
    // tipsHistory: jsonb('tips_history').$type<CVTip[]>().default([]).notNull(),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => {
    return {
        cvEmbeddingIdx: index('cv_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
        profileIdx: index('profile_idx').on(table.profileId),
    };
});


export const cvsRelations = relations(cvs, ({ one }) => ({
    profile: one(smartProfiles, {
        fields: [cvs.profileId],
        references: [smartProfiles.profileId],
    }),
}));
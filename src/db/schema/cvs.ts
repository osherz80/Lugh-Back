import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, vector, index, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';
import { CVTip } from 'src/cvs/types/cv';
import { education, jobExperiences, smartProfiles, users } from './index';

export const cvs = pgTable('cvs', {
    id: uuid('id').defaultRandom().primaryKey(),
    candidateId: uuid('candidate_id')
        .references(() => users.id),
    profileId: uuid('profile_id')
        .references(() => smartProfiles.profileId, { onDelete: 'cascade' }),

    // File Management
    fileName: text('file_name').notNull(),
    fileUrl: text('file_url'),
    isMaster: boolean('is_master').default(false).notNull(),

    // Content Layers
    content: text('content'),
    embedding: vector('embedding', { dimensions: 256 }),// TODO: add chunking(ColBERT)

    // Metrics
    overallScore: integer('overall_score').default(0),
    atsScore: integer('ats_score').default(0),
    keywordsScore: integer('keywords_score').default(0),
    impactScore: integer('impact_score').default(0),
    layoutScore: integer('layout_score').default(0),
    tips: jsonb('tips').$type<CVTip[]>().default([]),
    // tipsHistory: jsonb('tips_history').$type<CVTip[]>().default([]).notNull(),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),

    // smart profile generated
    roleTag: text('role_tag'),
    country: text('country'),
    city: text('city'),
    email: text('email'),
    phone: text('phone'),
    github: text('github'),
    portfolio: text('portfolio'),
    linkedIn: text('linkedin'),
    summary: text('summary'),
    structuredSkills: jsonb('structured_skills').$type<{ category: string, skills: string[] }>().array()

}, (table) => {
    return {
        cvEmbeddingIdx: index('cv_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
        profileIdx: index('profile_idx').on(table.profileId),
    };
});


export const cvsProfileRelations = relations(cvs, ({ one, many }) => ({
    profile: one(smartProfiles, {
        fields: [cvs.profileId],
        references: [smartProfiles.profileId],
    }),
    candidate: one(users, {
        fields: [cvs.candidateId],
        references: [users.id],
    }),
    experiences: many(jobExperiences),
    education: many(education),
}));

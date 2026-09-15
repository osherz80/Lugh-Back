import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, vector, index, timestamp, boolean, integer, jsonb, varchar } from 'drizzle-orm/pg-core';
import { CVTip } from 'src/cvs/types/cv';
import { documentChunks, education, jobExperiences, smartProfiles, users } from './index';

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

    // Metrics
    overallScore: integer('overall_score').default(0),
    atsScore: integer('ats_score').default(0),
    keywordsScore: integer('keywords_score').default(0),
    impactScore: integer('impact_score').default(0),
    layoutScore: integer('layout_score').default(0),
    tips: jsonb('tips').$type<CVTip[]>().default([]),
    // tipsHistory: jsonb('tips_history').$type<CVTip[]>().default([]).notNull(),



    //** Content Layers **/
    content: text('content'),
    summary: text('summary'),

    // Basics
    fullName: varchar('full_name', { length: 50 }),
    targetRole: varchar('target_role', { length: 50 }),
    yearsOfExperience: integer('years_of_experience').default(0),
    country: varchar('country', { length: 25 }),
    city: varchar('city', { length: 25 }),

    // Contact
    phone: varchar('phone', { length: 20 }),
    email: varchar('email', { length: 100 }),
    linkedin: text('linkedin'),
    github: text('github'),
    portfolio: text('portfolio'),

    // Skills
    skills: jsonb('skills').$type<{ category: string, skills: string[] }>().array(),

    // Persona
    persona: jsonb('persona').$type<{
        style: string[];
        strengths: string[];
        story: string;
    }>().default({ style: [], strengths: [], story: "" }),

    education: jsonb('education').$type<{
        institution: string;
        degree: string;
        startDate: string;
        endDate: string;
        isOngoing: boolean;
        description: string;
    }>().array(),

    experiences: jsonb('experiences').$type<{
        company: string;
        roleTag: string;
        startDate: string;
        endDate: string;
        isCurrent: boolean;
        description: string;
        bullets: string[];
    }>().array(),

    cvExtraEntries: jsonb('cv_extra_entries').$type<{
        entryName: string;
        entryContent: string[];
    }>().default({ entryName: '', entryContent: [] }),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),

}, (table) => {
    return {
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
    experiences: many(jobExperiences, { relationName: 'cv_experiences' }),
    education: many(education, { relationName: 'cv_education' }),
    chunks: many(documentChunks),
}));


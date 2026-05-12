import { pgTable, uuid, varchar, integer, jsonb, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { education, jobExperiences } from './index';

export const smartProfiles = pgTable('smart_profiles', {
    id: uuid('id').primaryKey().defaultRandom(),
    candidateId: uuid('candidate_id').notNull().unique(),

    // Basics
    fullName: varchar('full_name', { length: 50 }),
    targetRole: varchar('target_role', { length: 50 }),
    yearsOfExperience: integer('years_of_experience').default(0),
    country: varchar('country', { length: 25 }),
    city: varchar('city', { length: 25 }),

    // Skills
    skills: jsonb('skills').$type<Record<string, string>>().default({}),

    // Persona
    persona: jsonb('persona').$type<{
        style: string[];
        strengths: string[];
        story: string;
    }>().default({ style: [], strengths: [], story: "" }),

    // Contact
    phone: varchar('phone', { length: 20 }),
    email: varchar('email', { length: 100 }),
    linkedin: text('linkedin'),
    github: text('github'),
    portfolio: text('portfolio'),

    // Extra
    anythingElse: text('anything_else'),
    currentStep: integer('current_step').default(1),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const smartProfilesRelations = relations(smartProfiles, ({ many }) => ({
    experiences: many(jobExperiences),
    education: many(education),
}));

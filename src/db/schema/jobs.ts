import { relations, sql } from 'drizzle-orm';
import { pgTable, uuid, text, vector, index, timestamp, integer } from 'drizzle-orm/pg-core';
import { documentChunks } from './index';

export const jobs = pgTable('jobs', {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    responsibilities: text('responsibilities').notNull(),
    requirements: text('requirements').notNull(),
    niceToHave: text('nice_to_have').notNull(),
    benefits: text('benefits'),
    company: text('company'),
    aboutCompany: text('about_company'),
    department: text('department'),
    location: text('location'),
    workModel: text('work_model'),
    employmentType: text('employment_type'),
    experienceLevel: text('experience_level'),
    salaryRange: text('salary_range'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
    titleRequirementsSearchIdx: index('jobs_title_requirements_search_idx').using(
        'gin',
        sql`to_tsvector('simple', ${table.title} || ' ' || coalesce(${table.requirements}, ''))`,
    ),
}));

export const jobsRelations = relations(jobs, ({ many }) => ({
    chunks: many(documentChunks),
}));
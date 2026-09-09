import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, vector, index, timestamp } from 'drizzle-orm/pg-core';
import { documentChunks } from './index';

export const jobs = pgTable('jobs', {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    responsibilities: text('responsibilities').notNull(),
    requirements: text('requirements').notNull(),
    niceToHave: text('nice_to_have').notNull(),
    benefits: text('benefits'),
    aboutCompany: text('about_company'),
    department: text('department'),
    location: text('location'),
    workModel: text('work_model'),
    employmentType: text('employment_type'),
    experienceLevel: text('experience_level'),
    salaryRange: text('salary_range'),
    embedding: vector('embedding', { dimensions: 256 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
    return {
        jobEmbeddingIdx: index('job_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
    };
});

export const jobsRelations = relations(jobs, ({ many }) => ({
    chunks: many(documentChunks),
}));
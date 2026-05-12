import { relations } from "drizzle-orm";
import { varchar, text, uuid, boolean, pgTable } from "drizzle-orm/pg-core";
import { smartProfiles } from "./smartProfiles";

export const jobExperiences = pgTable('job_experiences', {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id').references(() => smartProfiles.id, { onDelete: 'cascade' }).notNull(),
    company: varchar('company', { length: 255 }).notNull(),
    roleTag: varchar('role_tag', { length: 255 }).notNull(),
    startDate: varchar('start_date', { length: 50 }).notNull(),
    endDate: varchar('end_date', { length: 50 }),
    isCurrent: boolean('is_current').default(false),
    description: text('description').notNull(),
});

export const jobExperiencesRelations = relations(jobExperiences, ({ one }) => ({
    profile: one(smartProfiles, {
        fields: [jobExperiences.profileId],
        references: [smartProfiles.id],
    }),
}));
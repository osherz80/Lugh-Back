import { relations } from "drizzle-orm";
import { varchar, text, uuid, boolean, pgTable, uniqueIndex } from "drizzle-orm/pg-core";
import { smartProfiles } from "./smartProfiles";
import { cvs } from "./cvs";

export const jobExperiences = pgTable('job_experiences', {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
        .references(() => smartProfiles.profileId, { onDelete: 'cascade' }),
    cvId: uuid('cv_id')
        .references(() => cvs.id, { onDelete: 'cascade' }),
    company: varchar('company', { length: 255 }).notNull(),
    roleTag: varchar('role_tag', { length: 255 }).notNull(),
    startDate: varchar('start_date', { length: 50 }).notNull(),
    endDate: varchar('end_date', { length: 50 }),
    isCurrent: boolean('is_current').default(false),
    description: text('description').notNull(),
    bullets: text('bullets').$type<string[]>(),
}, (table) => ({
    unq: uniqueIndex('job_experience_id_profile_id_key').on(table.id, table.profileId),
}));

export const jobExperiencesRelations = relations(jobExperiences, ({ one }) => ({
    profile: one(smartProfiles, {
        fields: [jobExperiences.profileId],
        references: [smartProfiles.profileId],
    }),
    cv: one(cvs, {
        fields: [jobExperiences.cvId],
        references: [cvs.id],
    }),
}));
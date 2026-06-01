import { relations } from "drizzle-orm";
import { boolean, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { cvs, smartProfiles } from "./index";

export const education = pgTable('education', {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
        .references(() => smartProfiles.profileId, { onDelete: 'cascade' }),
    cvId: uuid('cv_id')
        .references(() => cvs.id, { onDelete: 'cascade' }),
    institution: varchar('institution', { length: 255 }).notNull(),
    degree: varchar('degree', { length: 255 }).notNull(),
    startDate: varchar('start_date', { length: 50 }).notNull(),
    endDate: varchar('end_date', { length: 50 }),
    isOngoing: boolean('is_ongoing').default(false),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    unq: uniqueIndex('education_id_profile_id_key').on(table.id, table.profileId),
}));

export const educationRelations = relations(education, ({ one }) => ({
    profile: one(smartProfiles, {
        fields: [education.profileId],
        references: [smartProfiles.profileId],
    }),
    cv: one(cvs, {
        fields: [education.profileId],
        references: [cvs.profileId],
    })
}));
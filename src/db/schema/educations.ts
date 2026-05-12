import { relations } from "drizzle-orm";
import { boolean, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { smartProfiles } from "./index";

export const education = pgTable('education', {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id').references(() => smartProfiles.id, { onDelete: 'cascade' }).notNull(),
    institution: varchar('institution', { length: 255 }).notNull(),
    degree: varchar('degree', { length: 255 }).notNull(),
    startDate: varchar('start_date', { length: 50 }).notNull(),
    endDate: varchar('end_date', { length: 50 }),
    isOngoing: boolean('is_ongoing').default(false),
    description: text('description'),
});

export const educationRelations = relations(education, ({ one }) => ({
    profile: one(smartProfiles, {
        fields: [education.profileId],
        references: [smartProfiles.id],
    }),
}));
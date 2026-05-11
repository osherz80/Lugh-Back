import { pgTable, uuid, text, vector, index, timestamp, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

import { cvs, users, candidates } from './index';

export const smartProfiles = pgTable('smartProfiles', {
    id: uuid('id').primaryKey().defaultRandom(),
    // candidateId: uuid('candidate_id')
    //     .references(() => candidates.userId, { onDelete: 'cascade' }),
    fullName: text('full_name').notNull(),
    roleTag: text('role_tag').notNull(),
    experience: integer('experience').notNull(),
    country: text('country').notNull(),
    city: text('city').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});
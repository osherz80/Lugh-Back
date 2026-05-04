import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { candidates } from './index';

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    username: text('username').notNull(),
    email: text('email').notNull().unique(),
    password: text('password').notNull(),
    profilePicture: text('profile_picture'),
    refreshTokens: text('refresh_tokens').array().default([]),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export const usersRelations = relations(users, ({ one }) => ({
    candidate: one(candidates, {
        fields: [users.id],
        references: [candidates.userId],
    }),
}));
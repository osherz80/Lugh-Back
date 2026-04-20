import { pgTable, uuid, text, vector, index, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { candidates } from './candidates';

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    username: text('username'),
    email: text('email').notNull().unique(),
    password: text('password').notNull(),
    profilePicture: text('profilePicture'),
    refreshTokens: text('refreshTokens').array().default([]),
    createdAt: timestamp('createdAt').defaultNow(),
    updatedAt: timestamp('updatedAt').defaultNow(),
});

export const usersRelations = relations(users, ({ one }) => ({
    candidate: one(candidates, {
        fields: [users.id],
        references: [candidates.userId],
    }),
}));
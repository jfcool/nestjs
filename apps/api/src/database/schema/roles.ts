import { pgTable, serial, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { userRoles } from './user-roles';

export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: varchar('description', { length: 255 }),
  permissions: jsonb('permissions').notNull().$type<string[]>(),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
});

// Relations
export const rolesRelations = relations(roles, ({ many }) => ({
  userRoles: many(userRoles),
}));

// Type exports
export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;

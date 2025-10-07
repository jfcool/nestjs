import { pgTable, uuid, varchar, boolean, text, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core';
import { secretTypeEnum } from './enums';

export const sapSecrets = pgTable(
  'sap_secrets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull().unique(),
    type: secretTypeEnum('type').notNull().default('password'),
    encryptedValue: text('encryptedValue').notNull(), // Encrypted secret value
    description: varchar('description', { length: 255 }),
    isActive: boolean('isActive').notNull().default(true),
    expiresAt: timestamp('expiresAt', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, any>>(),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
    createdBy: varchar('createdBy', { length: 255 }),
    updatedBy: varchar('updatedBy', { length: 255 }),
    lastAccessedAt: timestamp('lastAccessedAt', { withTimezone: true }),
    accessCount: integer('accessCount').notNull().default(0),
  },
  (table) => ({
    nameIdx: index('IDX_sap_secrets_name').on(table.name),
    typeIdx: index('IDX_sap_secrets_type').on(table.type),
  }),
);

// Type exports
export type SapSecret = typeof sapSecrets.$inferSelect;
export type NewSapSecret = typeof sapSecrets.$inferInsert;

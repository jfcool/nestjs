import { pgTable, uuid, varchar, boolean, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { connectionTypeEnum } from './enums';

export const connections = pgTable(
  'connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull().unique(),
    type: connectionTypeEnum('type').notNull(),
    description: varchar('description', { length: 500 }),
    isActive: boolean('isActive').notNull().default(true),
    parameters: jsonb('parameters').notNull().$type<Record<string, any>>(),
    cacheConnectionId: uuid('cacheConnectionId'), // Reference to another connection (for SAP connections)
    metadata: jsonb('metadata').$type<Record<string, any>>(),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
    createdBy: varchar('createdBy', { length: 255 }),
    updatedBy: varchar('updatedBy', { length: 255 }),
  },
  (table) => ({
    nameIdx: index('IDX_connections_name').on(table.name),
  }),
);

// Type exports
export type Connection = typeof connections.$inferSelect;
export type NewConnection = typeof connections.$inferInsert;

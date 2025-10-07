import { pgTable, uuid, integer, text, timestamp, customType } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { documents } from './documents';

// Custom type for pgvector
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(768)';
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value);
  },
});

export const chunks = pgTable('chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  document_id: uuid('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  chunk_index: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  token_count: integer('token_count').notNull(),
  embedding: vector('embedding'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
});

// Relations
export const chunksRelations = relations(chunks, ({ one }) => ({
  document: one(documents, {
    fields: [chunks.document_id],
    references: [documents.id],
  }),
}));

// Type exports
export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;

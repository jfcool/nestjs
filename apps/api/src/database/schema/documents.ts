import { pgTable, uuid, varchar, timestamp, jsonb, text, bigint, real, integer, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { chunks } from './chunks';

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    path: varchar('path', { length: 500 }).notNull().unique(),
    mtime: timestamp('mtime', { withTimezone: true }).notNull(),
    sha256: varchar('sha256', { length: 64 }).notNull(),
    meta: jsonb('meta').notNull().default({}),
    title: varchar('title', { length: 500 }),
    fileType: varchar('fileType', { length: 100 }),
    fileSize: bigint('fileSize', { mode: 'number' }).notNull().default(0),
    // Enhanced metadata for better search and classification
    documentType: varchar('documentType', { length: 100 }), // 'invoice', 'certificate', 'contract', 'report', etc.
    category: varchar('category', { length: 100 }), // 'financial', 'legal', 'technical', 'personal', etc.
    language: varchar('language', { length: 10 }), // 'de', 'en', etc.
    summary: text('summary'), // AI-generated summary for better search
    keywords: text('keywords').array(), // Extracted keywords for search
    extractedData: jsonb('extractedData').default({}), // Structured data (dates, amounts, etc.)
    importance: real('importance').notNull().default(1.0), // Importance score (0.0 - 2.0, default 1.0)
    accessCount: integer('accessCount').notNull().default(0), // How often this document was accessed
    lastAccessedAt: timestamp('lastAccessedAt', { withTimezone: true }), // When was it last accessed
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    documentTypeIdx: index('IDX_documents_documentType').on(table.documentType),
    categoryIdx: index('IDX_documents_category').on(table.category),
    importanceIdx: index('IDX_documents_importance').on(table.importance),
    accessCountIdx: index('IDX_documents_accessCount').on(table.accessCount),
  }),
);

// Relations
export const documentsRelations = relations(documents, ({ many }) => ({
  chunks: many(chunks),
}));

// Type exports
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

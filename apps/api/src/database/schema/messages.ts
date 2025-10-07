import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { conversations } from './conversations';
import { messageRoleEnum } from './enums';

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  role: messageRoleEnum('role').notNull(),
  content: text('content').notNull(),
  metadata: jsonb('metadata').$type<any>(),
  mcpToolCalls: jsonb('mcpToolCalls').$type<any[]>(),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  conversationId: uuid('conversationId')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
});

// Relations
export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

// Type exports
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

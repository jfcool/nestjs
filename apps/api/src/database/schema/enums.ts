import { pgEnum } from 'drizzle-orm/pg-core';

// Message role enum
export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant', 'system']);

// Connection type enum
export const connectionTypeEnum = pgEnum('connection_type', ['sap', 'agentdb']);

// Secret type enum
export const secretTypeEnum = pgEnum('secret_type', [
  'password',
  'api_key',
  'token',
  'certificate',
  'other',
]);

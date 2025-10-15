-- Add user tracking to conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS "createdBy" VARCHAR(255);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS "activeUsers" JSONB DEFAULT '[]'::jsonb;

-- Add user tracking to messages  
ALTER TABLE messages ADD COLUMN IF NOT EXISTS "userId" VARCHAR(255);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS "username" VARCHAR(255);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "conversations_createdBy_idx" ON conversations("createdBy");
CREATE INDEX IF NOT EXISTS "messages_userId_idx" ON messages("userId");

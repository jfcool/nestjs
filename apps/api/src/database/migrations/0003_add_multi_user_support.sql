-- Add user tracking to conversations
ALTER TABLE conversations ADD COLUMN "createdBy" INTEGER;
ALTER TABLE conversations ADD COLUMN "activeUsers" JSONB DEFAULT '[]'::jsonb;

-- Add user tracking to messages  
ALTER TABLE messages ADD COLUMN "userId" INTEGER;
ALTER TABLE messages ADD COLUMN "username" VARCHAR(255);

-- Add index for better performance
CREATE INDEX idx_conversations_created_by ON conversations("createdBy");
CREATE INDEX idx_messages_user_id ON messages("userId");

-- Comments
COMMENT ON COLUMN conversations."createdBy" IS 'User ID who created the conversation';
COMMENT ON COLUMN conversations."activeUsers" IS 'Array of user IDs currently viewing this conversation';
COMMENT ON COLUMN messages."userId" IS 'User ID who created the message (null for AI messages)';
COMMENT ON COLUMN messages."username" IS 'Username who created the message (AI for AI messages)';

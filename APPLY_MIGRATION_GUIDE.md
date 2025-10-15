# Manual Migration Application Guide

## Issue
The database migration for multi-user chat support needs to be applied to the database. The automatic migration is encountering issues.

## Solution Options

### Option 1: Using pgAdmin or Database Client (Recommended)

1. **Open your PostgreSQL client** (pgAdmin, DBeaver, or similar)

2. **Connect to your database** using the credentials from `apps/api/.env`

3. **Run the following SQL commands:**

```sql
-- Add columns to conversations table
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS "createdBy" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "activeUsers" JSONB DEFAULT '[]'::jsonb;

-- Add columns to messages table
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS "userId" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "username" VARCHAR(255);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "conversations_createdBy_idx" ON conversations("createdBy");
CREATE INDEX IF NOT EXISTS "messages_userId_idx" ON messages("userId");
```

4. **Verify the changes:**

```sql
-- Check conversations table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'conversations' 
AND column_name IN ('createdBy', 'activeUsers');

-- Check messages table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND column_name IN ('userId', 'username');
```

Expected results:
- `conversations.createdBy` - varchar, nullable
- `conversations.activeUsers` - jsonb, nullable
- `messages.userId` - varchar, nullable
- `messages.username` - varchar, nullable

### Option 2: Using psql Command Line

1. **Open a terminal**

2. **Connect to PostgreSQL:**
```bash
psql -h localhost -U your_username -d your_database_name
```

3. **Copy and paste the SQL from Option 1**

4. **Exit psql:**
```
\q
```

### Option 3: Using Docker (if database is in Docker)

1. **Find your PostgreSQL container:**
```bash
docker ps | grep postgres
```

2. **Connect to the container:**
```bash
docker exec -it <container_name> psql -U <username> -d <database_name>
```

3. **Run the SQL commands from Option 1**

## After Migration is Applied

1. **Kill the stuck drizzle-kit process** (Ctrl+C in the terminal)

2. **Restart your API server:**
```bash
cd apps/api
npm run start:dev
```

3. **Refresh your browser** - The error should be gone

4. **Verify the API is working:**
   - Open http://localhost:3001/api (or your API URL)
   - Check that `/chat/conversations` endpoint works

## Troubleshooting

### If you still get errors after applying the migration:

1. **Check if columns were actually created:**
```sql
\d conversations
\d messages
```

2. **Check for any existing data issues:**
```sql
-- Check if any conversations have NULL in new columns (should be fine)
SELECT COUNT(*) FROM conversations WHERE "activeUsers" IS NULL;

-- Update any NULL activeUsers to empty array
UPDATE conversations SET "activeUsers" = '[]'::jsonb WHERE "activeUsers" IS NULL;
```

3. **Restart the API server** to clear any cached schema information

### If the API still won't start:

Check the API logs for specific errors:
```bash
cd apps/api
npm run start:dev
```

Look for error messages related to:
- Database connection
- Column not found errors
- Type mismatches

## Quick Verification Queries

After migration, these queries should all work without errors:

```sql
-- Test 1: Select with new columns
SELECT id, title, "createdBy", "activeUsers" FROM conversations LIMIT 1;

-- Test 2: Select messages with new columns
SELECT id, content, role, "userId", "username" FROM messages LIMIT 1;

-- Test 3: Insert test data
INSERT INTO conversations (id, title, "createdBy", "activeUsers") 
VALUES (gen_random_uuid(), 'Test', 'user123', '[]'::jsonb);

-- Clean up test
DELETE FROM conversations WHERE title = 'Test';
```

## Contact

If you continue having issues, the SQL migration file is located at:
`apps/api/src/database/migrations/0003_add_multi_user_support.sql`

You can review the exact SQL that needs to be applied there.

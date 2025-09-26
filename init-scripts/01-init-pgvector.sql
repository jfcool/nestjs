-- Initialize pgvector extension and create necessary indexes
-- This script runs automatically when the PostgreSQL container starts

-- Create the vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify the extension is installed
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- Create indexes for better performance (will be created after tables exist)
-- These will be created by the NestJS migrations, but we prepare the database

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'pgvector extension initialized successfully';
    RAISE NOTICE 'Database is ready for vector operations';
END $$;

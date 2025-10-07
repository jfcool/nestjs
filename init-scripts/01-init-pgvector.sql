-- Initialize pgvector and pg_trgm extensions and create necessary indexes
-- This script runs automatically when the PostgreSQL container starts

-- Create the vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the pg_trgm extension for text search similarity
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Verify the extensions are installed
SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector', 'pg_trgm');

-- Create indexes for better performance (will be created after tables exist)
-- These will be created by the NestJS migrations, but we prepare the database

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'pgvector extension initialized successfully';
    RAISE NOTICE 'pg_trgm extension initialized successfully';
    RAISE NOTICE 'Database is ready for vector operations and text similarity search';
END $$;

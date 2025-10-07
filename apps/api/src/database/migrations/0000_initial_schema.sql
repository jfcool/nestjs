-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create enums
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'system');
CREATE TYPE "public"."connection_type" AS ENUM('sap', 'agentdb');
CREATE TYPE "public"."secret_type" AS ENUM('password', 'api_key', 'token', 'certificate', 'other');

-- Create users table
CREATE TABLE IF NOT EXISTS "users" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(255) NOT NULL,
  "email" varchar(255),
  "username" varchar(100) UNIQUE,
  "passwordHash" varchar(255),
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create roles table
CREATE TABLE IF NOT EXISTS "roles" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(100) NOT NULL UNIQUE,
  "description" varchar(255),
  "permissions" jsonb NOT NULL,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create user_roles junction table
CREATE TABLE IF NOT EXISTS "user_roles" (
  "userId" integer NOT NULL,
  "roleId" integer NOT NULL,
  PRIMARY KEY ("userId", "roleId"),
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
  FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE
);

-- Create conversations table
CREATE TABLE IF NOT EXISTS "conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" varchar(255) NOT NULL,
  "model" varchar(100) DEFAULT 'gpt-4' NOT NULL,
  "systemPrompt" jsonb,
  "mcpServers" jsonb,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create messages table
CREATE TABLE IF NOT EXISTS "messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "role" "message_role" NOT NULL,
  "content" text NOT NULL,
  "metadata" jsonb,
  "mcpToolCalls" jsonb,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "conversationId" uuid NOT NULL,
  FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE
);

-- Create documents table
CREATE TABLE IF NOT EXISTS "documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "path" varchar(500) NOT NULL UNIQUE,
  "mtime" timestamp with time zone NOT NULL,
  "sha256" varchar(64) NOT NULL,
  "meta" jsonb DEFAULT '{}' NOT NULL,
  "title" varchar(500),
  "fileType" varchar(100),
  "fileSize" bigint DEFAULT 0 NOT NULL,
  "documentType" varchar(100),
  "category" varchar(100),
  "language" varchar(10),
  "summary" text,
  "keywords" text[],
  "extractedData" jsonb DEFAULT '{}',
  "importance" real DEFAULT 1.0 NOT NULL,
  "accessCount" integer DEFAULT 0 NOT NULL,
  "lastAccessedAt" timestamp with time zone,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes for documents
CREATE INDEX "IDX_documents_documentType" ON "documents" ("documentType");
CREATE INDEX "IDX_documents_category" ON "documents" ("category");
CREATE INDEX "IDX_documents_importance" ON "documents" ("importance");
CREATE INDEX "IDX_documents_accessCount" ON "documents" ("accessCount");
CREATE INDEX "IDX_documents_extractedData_gin" ON "documents" USING GIN ("extractedData");

-- Create chunks table with pgvector
CREATE TABLE IF NOT EXISTS "chunks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "document_id" uuid NOT NULL,
  "chunk_index" integer NOT NULL,
  "content" text NOT NULL,
  "token_count" integer NOT NULL,
  "embedding" vector(768),
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
  FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE
);

-- Create pgvector indexes for chunks
CREATE INDEX "idx_chunks_embedding_cosine" ON "chunks" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
CREATE INDEX "idx_chunks_embedding_l2" ON "chunks" USING ivfflat ("embedding" vector_l2_ops) WITH (lists = 100);

-- Create connections table
CREATE TABLE IF NOT EXISTS "connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL UNIQUE,
  "type" "connection_type" NOT NULL,
  "description" varchar(500),
  "isActive" boolean DEFAULT true NOT NULL,
  "parameters" jsonb NOT NULL,
  "cacheConnectionId" uuid,
  "metadata" jsonb,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
  "createdBy" varchar(255),
  "updatedBy" varchar(255)
);

CREATE INDEX "IDX_connections_name" ON "connections" ("name");

-- Create sap_secrets table
CREATE TABLE IF NOT EXISTS "sap_secrets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL UNIQUE,
  "type" "secret_type" DEFAULT 'password' NOT NULL,
  "encryptedValue" text NOT NULL,
  "description" varchar(255),
  "isActive" boolean DEFAULT true NOT NULL,
  "expiresAt" timestamp with time zone,
  "metadata" jsonb,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
  "createdBy" varchar(255),
  "updatedBy" varchar(255),
  "lastAccessedAt" timestamp with time zone,
  "accessCount" integer DEFAULT 0 NOT NULL
);

CREATE INDEX "IDX_sap_secrets_name" ON "sap_secrets" ("name");
CREATE INDEX "IDX_sap_secrets_type" ON "sap_secrets" ("type");

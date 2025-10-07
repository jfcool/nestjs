CREATE TYPE "public"."connection_type" AS ENUM('sap', 'agentdb');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'system');--> statement-breakpoint
CREATE TYPE "public"."secret_type" AS ENUM('password', 'api_key', 'token', 'certificate', 'other');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"username" varchar(100),
	"passwordHash" varchar(255),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(255),
	"permissions" jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_roles" (
	"userId" integer NOT NULL,
	"roleId" integer NOT NULL,
	CONSTRAINT "user_roles_userId_roleId_pk" PRIMARY KEY("userId","roleId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"model" varchar(100) DEFAULT 'gpt-4' NOT NULL,
	"systemPrompt" jsonb,
	"mcpServers" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"mcpToolCalls" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"conversationId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" varchar(500) NOT NULL,
	"mtime" timestamp with time zone NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"title" varchar(500),
	"fileType" varchar(100),
	"fileSize" bigint DEFAULT 0 NOT NULL,
	"documentType" varchar(100),
	"category" varchar(100),
	"language" varchar(10),
	"summary" text,
	"keywords" text[],
	"extractedData" jsonb DEFAULT '{}'::jsonb,
	"importance" real DEFAULT 1 NOT NULL,
	"accessCount" integer DEFAULT 0 NOT NULL,
	"lastAccessedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_path_unique" UNIQUE("path")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"token_count" integer NOT NULL,
	"embedding" vector(768),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "connection_type" NOT NULL,
	"description" varchar(500),
	"isActive" boolean DEFAULT true NOT NULL,
	"parameters" jsonb NOT NULL,
	"cacheConnectionId" uuid,
	"metadata" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"createdBy" varchar(255),
	"updatedBy" varchar(255),
	CONSTRAINT "connections_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sap_secrets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
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
	"accessCount" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "sap_secrets_name_unique" UNIQUE("name")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_roles_id_fk" FOREIGN KEY ("roleId") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_conversations_id_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chunks" ADD CONSTRAINT "chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_documents_documentType" ON "documents" USING btree ("documentType");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_documents_category" ON "documents" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_documents_importance" ON "documents" USING btree ("importance");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_documents_accessCount" ON "documents" USING btree ("accessCount");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_connections_name" ON "connections" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_sap_secrets_name" ON "sap_secrets" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_sap_secrets_type" ON "sap_secrets" USING btree ("type");
#!/usr/bin/env tsx
/**
 * Quick script to check document indexing status
 */
import { config } from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './src/database/schema';
import { count, sql } from 'drizzle-orm';

// Load environment variables
config({ path: ['.env', '../.env', '../../.env'] });

async function checkDocuments() {
  console.log('🔍 Checking document indexing status...\n');

  // Create connection
  const connectionString = `postgresql://${process.env.DB_USERNAME || 'postgres'}:${process.env.DB_PASSWORD || 'joe'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'nestjs_app'}`;
  
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    // Check if tables exist
    console.log('📊 Checking tables...');
    const tables = await client`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('documents', 'chunks')
      ORDER BY table_name
    `;
    console.log('Available tables:', tables.map(t => t.table_name).join(', '));
    console.log();

    // Count documents
    const [docsResult] = await db
      .select({ count: count() })
      .from(schema.documents);
    console.log(`📄 Total Documents: ${docsResult.count}`);

    // Count chunks
    const [chunksResult] = await db
      .select({ count: count() })
      .from(schema.chunks);
    console.log(`🧩 Total Chunks: ${chunksResult.count}`);
    console.log();

    // Get all documents with details
    if (docsResult.count > 0) {
      console.log('📋 Document Details:');
      const documents = await db.query.documents.findMany({
        limit: 20,
      });

      for (const doc of documents) {
        const [chunkCount] = await db
          .select({ count: count() })
          .from(schema.chunks)
          .where(sql`${schema.chunks.document_id} = ${doc.id}`);
        
        console.log(`\n  • ID: ${doc.id}`);
        console.log(`    Path: ${doc.path}`);
        console.log(`    Title: ${doc.title}`);
        console.log(`    Type: ${doc.fileType}`);
        console.log(`    Size: ${doc.fileSize} bytes`);
        console.log(`    Chunks: ${chunkCount.count}`);
        console.log(`    Created: ${doc.createdAt}`);
      }
    } else {
      console.log('⚠️  No documents found in database!');
      console.log('   This means files have not been indexed yet.');
    }

    // Check chunks table structure
    console.log('\n🔧 Chunks Table Structure:');
    const chunkColumns = await client`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'chunks'
      ORDER BY ordinal_position
    `;
    for (const col of chunkColumns) {
      console.log(`  • ${col.column_name}: ${col.data_type} (${col.udt_name})`);
    }

    // Sample a few chunks if they exist
    if (chunksResult.count > 0) {
      console.log('\n📦 Sample Chunks:');
      const sampleChunks = await db.query.chunks.findMany({
        limit: 3,
      });

      for (const chunk of sampleChunks) {
        console.log(`\n  • Chunk ${chunk.chunk_index} of document ${chunk.document_id}`);
        console.log(`    Content preview: ${chunk.content.substring(0, 100)}...`);
        console.log(`    Token count: ${chunk.token_count}`);
        console.log(`    Has embedding: ${chunk.embedding ? 'Yes' : 'No'}`);
      }
    }

    // Check pgvector extension
    console.log('\n🔌 Checking pgvector extension:');
    const extensions = await client`
      SELECT extname, extversion
      FROM pg_extension
      WHERE extname = 'vector'
    `;
    if (extensions.length > 0) {
      console.log(`  ✅ pgvector installed: version ${extensions[0].extversion}`);
    } else {
      console.log('  ❌ pgvector NOT installed!');
    }

    console.log('\n✅ Database check complete!');
    console.log('\n💡 To view the database in Drizzle Studio, run:');
    console.log('   cd apps/api && pnpm db:studio');
    console.log('   Then open: https://local.drizzle.studio');

  } catch (error) {
    console.error('❌ Error checking documents:', error);
    throw error;
  } finally {
    await client.end();
  }
}

checkDocuments()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

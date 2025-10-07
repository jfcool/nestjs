#!/usr/bin/env tsx
/**
 * Script to reindex all documents
 */
import { config } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DocumentIndexingService } from './src/documents/services/document-indexing.service';

// Load environment variables
config({ path: ['.env', '../.env', '../../.env'] });

async function reindexDocuments() {
  console.log('🔄 Starting document reindexing...\n');

  try {
    // Create NestJS application context
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['log', 'error', 'warn', 'debug'],
    });

    // Get the indexing service
    const indexingService = app.get(DocumentIndexingService);

    console.log('📊 Getting current stats...');
    const statsBefore = await indexingService.getDocumentStats();
    console.log(`   Documents: ${statsBefore.totalDocuments}`);
    console.log(`   Chunks: ${statsBefore.totalChunks}`);
    console.log();

    // Trigger reindexing
    console.log('🔄 Reindexing all documents...\n');
    await indexingService.reindexAll();

    console.log('\n📊 Getting updated stats...');
    const statsAfter = await indexingService.getDocumentStats();
    console.log(`   Documents: ${statsAfter.totalDocuments}`);
    console.log(`   Chunks: ${statsAfter.totalChunks}`);
    console.log();

    if (statsAfter.totalChunks > 0) {
      console.log('✅ SUCCESS! Chunks are now being created.');
      console.log(`   Created ${statsAfter.totalChunks} chunks from ${statsAfter.totalDocuments} documents`);
    } else if (statsAfter.totalDocuments > 0) {
      console.log('⚠️  WARNING: Documents were indexed but NO chunks were created.');
      console.log('   This usually means:');
      console.log('   1. PDF parsing is failing (check logs)');
      console.log('   2. Embedding service is unavailable (but chunks should still be created)');
      console.log('   3. Check application logs for detailed error messages');
    } else {
      console.log('⚠️  No documents were found to index.');
    }

    console.log('\n💡 To view the database, run:');
    console.log('   cd apps/api && pnpm db:studio');

    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during reindexing:', error);
    process.exit(1);
  }
}

reindexDocuments();

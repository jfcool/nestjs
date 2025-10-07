import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './src/database/schema';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'joe',
  database: process.env.DB_NAME || 'nestjs_app',
});

const db = drizzle(pool, { schema });

async function clearDocuments() {
  try {
    console.log('🗑️  Clearing existing documents and chunks...');
    
    // Delete all chunks
    await db.delete(schema.chunks);
    console.log('✅ Cleared chunks table');
    
    // Delete all documents
    await db.delete(schema.documents);
    console.log('✅ Cleared documents table');
    
    console.log('\n✨ Documents cleared! The file watcher will automatically reindex them with embeddings.');
    console.log('📁 Check the API logs to see the reindexing progress.\n');
    
  } catch (error) {
    console.error('❌ Error clearing documents:', error);
  } finally {
    await pool.end();
  }
}

clearDocuments();

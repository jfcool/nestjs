#!/usr/bin/env tsx
import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: ['.env', '../.env', '../../.env'] });

async function quickCheck() {
  const connectionString = `postgresql://${process.env.DB_USERNAME || 'postgres'}:${process.env.DB_PASSWORD || 'joe'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'nestjs_app'}`;
  
  const client = postgres(connectionString, { max: 1 });

  try {
    const docs = await client`SELECT COUNT(*) as count FROM documents`;
    const chunks = await client`SELECT COUNT(*) as count FROM chunks`;
    
    console.log(`Documents: ${docs[0].count}`);
    console.log(`Chunks: ${chunks[0].count}`);
    
    if (parseInt(chunks[0].count) > 0) {
      console.log('\n✅ SUCCESS! Chunks are being created!');
    } else {
      console.log('\n❌ Still 0 chunks - need to debug further');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

quickCheck();

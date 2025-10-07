import { config } from 'dotenv';
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as bcrypt from 'bcrypt';

// Load environment variables
config({ path: ['.env', '../.env', '../../.env'] });

async function runMigrations() {
  const connectionString = `postgres://${process.env.DB_USERNAME || 'postgres'}:${process.env.DB_PASSWORD || 'joe'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'nestjs_app'}`;
  
  const client = postgres(connectionString, { max: 1 });

  try {
    console.log('🚀 Running Drizzle migrations...');

    // Run initial schema migration
    console.log('📋 Running: 0000_initial_schema.sql');
    const initialSchema = readFileSync(
      join(__dirname, 'migrations', '0000_initial_schema.sql'),
      'utf-8'
    );
    await client.unsafe(initialSchema);
    console.log('✅ Initial schema created');

    // Generate bcrypt hashes for seed data
    const adminHash = await bcrypt.hash('admin', 10);
    const everestHash = await bcrypt.hash('everest', 10);

    // Run seed data migration with actual password hashes
    console.log('📋 Running: 0001_seed_initial_data.sql');
    let seedData = readFileSync(
      join(__dirname, 'migrations', '0001_seed_initial_data.sql'),
      'utf-8'
    );
    
    // Replace placeholder hashes with actual bcrypt hashes
    seedData = seedData
      .replace('$2b$10$YourActualBcryptHashHere1', adminHash)
      .replace('$2b$10$YourActualBcryptHashHere2', everestHash);
    
    await client.unsafe(seedData);
    console.log('✅ Seed data inserted');

    console.log('✅ All migrations completed successfully!');
    console.log('📋 Available accounts:');
    console.log('   - admin / admin (System Administrator)');
    console.log('   - everest / everest (Everest User - Chat & SAP Access)');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();

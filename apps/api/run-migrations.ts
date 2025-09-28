import 'reflect-metadata';
import { AppDataSource } from './src/data-source';

async function runMigrations() {
  console.log('🔄 Running database migrations...');
  
  try {
    // Initialize the data source
    await AppDataSource.initialize();
    console.log('✅ Database connection established');
    
    // Run pending migrations
    const migrations = await AppDataSource.runMigrations();
    
    if (migrations.length === 0) {
      console.log('📋 No pending migrations found');
    } else {
      console.log(`✅ Successfully ran ${migrations.length} migration(s):`);
      migrations.forEach(migration => {
        console.log(`   - ${migration.name}`);
      });
    }
    
    console.log('✅ Migrations completed successfully!');
    console.log('📋 Available test accounts:');
    console.log('   - admin / admin (Administrator)');
    console.log('   - user / user (Standard User)');
    console.log('   - everest / everest (Everest User)');
    console.log('   - max.mustermann / test123 (Test User)');
    console.log('   - erika.musterfrau / test123 (Test User)');
    console.log('   - fraenki / test123 (Test User)');
    console.log('   - anna.schmidt / test123 (Test User)');
    console.log('   - peter.mueller / test123 (Test User)');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    // Close the connection
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

runMigrations();

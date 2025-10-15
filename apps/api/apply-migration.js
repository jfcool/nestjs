const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyMigration() {
  console.log('Connecting to database...');
  
  // Create connection
  const connectionString = process.env.DATABASE_URL;
  const sql = postgres(connectionString, { max: 1 });
  
  try {
    console.log('Reading migration file...');
    const migrationPath = path.join(__dirname, 'src/database/migrations/0003_add_multi_user_support.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Applying migration...');
    
    // Split the SQL into individual statements and execute them
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (const statement of statements) {
      console.log('Executing:', statement.substring(0, 100) + '...');
      await sql.unsafe(statement);
    }
    
    console.log('✅ Migration applied successfully!');
    
    // Verify the changes
    console.log('\nVerifying changes...');
    const conversationsColumns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'conversations' 
      AND column_name IN ('createdBy', 'activeUsers')
    `;
    
    const messagesColumns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'messages' 
      AND column_name IN ('userId', 'username')
    `;
    
    console.log('Conversations columns:', conversationsColumns);
    console.log('Messages columns:', messagesColumns);
    
    if (conversationsColumns.length === 2 && messagesColumns.length === 2) {
      console.log('\n✅ All columns created successfully!');
    } else {
      console.log('\n⚠️  Some columns may be missing');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

applyMigration()
  .then(() => {
    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });

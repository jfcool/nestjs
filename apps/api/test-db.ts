import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from './src/database/schema';

async function testDatabase() {
  const connectionString = 'postgresql://postgres:joe@localhost:5432/nestjs_app';
  const client = postgres(connectionString);
  const db = drizzle(client, { schema });

  try {
    console.log('🔍 Testing database connection...');
    
    // Test basic query
    const users = await db.select().from(schema.users);
    console.log(`✅ Found ${users.length} users`);
    
    // Test relational query
    console.log('\n🔍 Testing relational query...');
    const user = await db.query.users.findFirst({
      where: eq(schema.users.username, 'admin'),
      with: {
        userRoles: {
          with: {
            role: true,
          },
        },
      },
    });
    
    if (user) {
      console.log('✅ Found user:', {
        id: user.id,
        username: user.username,
        name: user.name,
        hasPassword: !!user.passwordHash,
        userRolesCount: user.userRoles?.length || 0,
      });
      
      if (user.userRoles && user.userRoles.length > 0) {
        console.log('✅ User roles:');
        user.userRoles.forEach(ur => {
          console.log(`  - ${ur.role.name} (ID: ${ur.role.id})`);
          console.log(`    Permissions:`, ur.role.permissions);
        });
      } else {
        console.log('⚠️  User has no roles assigned!');
      }
    } else {
      console.log('❌ Admin user not found!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

testDatabase();

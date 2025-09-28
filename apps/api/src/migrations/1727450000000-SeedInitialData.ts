import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

export class SeedInitialData1727450000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create roles first
    await queryRunner.query(`
      INSERT INTO roles (name, description, permissions, "createdAt", "updatedAt") 
      VALUES 
        ('admin', 'Full system administrator access', '["dashboard", "users", "sapodata", "documents", "chat", "permissions"]', NOW(), NOW()),
        ('everest', 'Access to Chat AI and SAP OData applications', '["chat", "sapodata"]', NOW(), NOW())
      ON CONFLICT (name) DO NOTHING;
    `);

    // Hash passwords
    const adminPasswordHash = await bcrypt.hash('admin', 10);
    const everestPasswordHash = await bcrypt.hash('everest', 10);

    // Create users with proper authentication credentials
    await queryRunner.query(`
      INSERT INTO users (username, "passwordHash", name, email, "createdAt", "updatedAt") 
      VALUES 
        ('admin', $1, 'System Administrator', 'admin@example.com', NOW(), NOW()),
        ('everest', $2, 'Everest User', 'everest@example.com', NOW(), NOW())
      ON CONFLICT (username) DO NOTHING;
    `, [adminPasswordHash, everestPasswordHash]);

    // Assign roles to users
    await queryRunner.query(`
      INSERT INTO user_roles ("userId", "roleId")
      SELECT u.id, r.id 
      FROM users u, roles r 
      WHERE (u.username = 'admin' AND r.name = 'admin')
         OR (u.username = 'everest' AND r.name = 'everest')
      ON CONFLICT DO NOTHING;
    `);

    // Create sample connections with working configuration
    await queryRunner.query(`
      INSERT INTO connections (id, name, type, description, parameters, "cacheConnectionId", "isActive", "createdAt", "updatedAt") 
      VALUES 
        ('53f3a6f4-6599-48cf-a64c-4da70fca62e1', 'AgentDB Cache', 'agentdb', 'Local AgentDB cache for SAP data', '{"token": "acd22c69-e92c-44e2-92b4-720b8f70426e", "apiKey": "agentdb_2d45bc1f95da0df642e994824e49450117c0aa798b80b787098aa979b668230e", "baseUrl": "https://api.agentdb.dev", "database": "SAP_ODATA_CACHE"}', null, true, NOW(), NOW()),
        ('243f0131-145e-4ded-a730-bdbc2dd40fa4', 'SAP Demo System', 'sap', 'Demo SAP connection for testing', '{"baseUrl": "https://3.238.76.92:44301", "timeout": 30000, "username": "EVEREST", "userAgent": "NestJS-SAP-OData-Client", "rejectUnauthorized": false}', '53f3a6f4-6599-48cf-a64c-4da70fca62e1', true, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    // Create secret for SAP connection password
    await queryRunner.query(`
      INSERT INTO secrets (id, name, value, type, description, "isActive", "createdAt", "updatedAt")
      VALUES ('eab004a1-b2fe-4de1-85db-8588f37d023c', 'connection-SAP Demo System-password', '$2b$10$encrypted_password_placeholder', 'password', 'Password for connection: SAP Demo System', true, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    // Update SAP connection to reference the password secret
    await queryRunner.query(`
      UPDATE connections 
      SET parameters = jsonb_set(parameters, '{passwordSecretId}', '"eab004a1-b2fe-4de1-85db-8588f37d023c"')
      WHERE id = '243f0131-145e-4ded-a730-bdbc2dd40fa4';
    `);

    console.log('✅ Initial data seeded successfully');
    console.log('📋 Available accounts:');
    console.log('   - admin / admin (System Administrator)');
    console.log('   - everest / everest (Everest User - Chat & SAP Access)');
    console.log('🔗 Sample connections created:');
    console.log('   - SAP Demo System (SAP connection)');
    console.log('   - AgentDB Cache (AgentDB connection)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove user-role associations
    await queryRunner.query(`DELETE FROM user_roles;`);
    
    // Remove users
    await queryRunner.query(`
      DELETE FROM users 
      WHERE username IN ('admin', 'everest');
    `);
    
    // Remove roles
    await queryRunner.query(`
      DELETE FROM roles 
      WHERE name IN ('admin', 'everest');
    `);

    // Remove sample connections
    await queryRunner.query(`
      DELETE FROM connections 
      WHERE id IN ('243f0131-145e-4ded-a730-bdbc2dd40fa4', '53f3a6f4-6599-48cf-a64c-4da70fca62e1');
    `);

    // Remove secrets
    await queryRunner.query(`
      DELETE FROM secrets 
      WHERE id = 'eab004a1-b2fe-4de1-85db-8588f37d023c';
    `);

    console.log('🗑️ Initial data removed');
  }
}

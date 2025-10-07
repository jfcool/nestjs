-- Seed initial roles
INSERT INTO "roles" ("name", "description", "permissions", "createdAt", "updatedAt") 
VALUES 
  ('admin', 'Full system administrator access', '["dashboard", "users", "sapodata", "documents", "chat", "permissions"]', NOW(), NOW()),
  ('everest', 'Access to Chat AI and SAP OData applications', '["chat", "sapodata"]', NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;

-- Seed initial users (passwords: 'admin' and 'everest' hashed with bcrypt)
-- Note: Replace these hashes with actual bcrypt hashes generated at runtime
INSERT INTO "users" ("username", "passwordHash", "name", "email", "createdAt", "updatedAt") 
VALUES 
  ('admin', '$2b$10$YourActualBcryptHashHere1', 'System Administrator', 'admin@example.com', NOW(), NOW()),
  ('everest', '$2b$10$YourActualBcryptHashHere2', 'Everest User', 'everest@example.com', NOW(), NOW())
ON CONFLICT ("username") DO NOTHING;

-- Assign roles to users
INSERT INTO "user_roles" ("userId", "roleId")
SELECT u.id, r.id 
FROM "users" u, "roles" r 
WHERE (u.username = 'admin' AND r.name = 'admin')
   OR (u.username = 'everest' AND r.name = 'everest')
ON CONFLICT DO NOTHING;

-- Seed sample connections
INSERT INTO "connections" ("id", "name", "type", "description", "parameters", "cacheConnectionId", "isActive", "createdAt", "updatedAt") 
VALUES 
  ('53f3a6f4-6599-48cf-a64c-4da70fca62e1', 'AgentDB Cache', 'agentdb', 'Local AgentDB cache for SAP data', 
   '{"token": "acd22c69-e92c-44e2-92b4-720b8f70426e", "apiKey": "agentdb_2d45bc1f95da0df642e994824e49450117c0aa798b80b787098aa979b668230e", "baseUrl": "https://api.agentdb.dev", "database": "SAP_ODATA_CACHE"}', 
   NULL, true, NOW(), NOW()),
  ('243f0131-145e-4ded-a730-bdbc2dd40fa4', 'SAP Demo System', 'sap', 'Demo SAP connection for testing', 
   '{"baseUrl": "https://3.238.76.92:44301", "timeout": 30000, "username": "EVEREST", "userAgent": "NestJS-SAP-OData-Client", "rejectUnauthorized": false}', 
   '53f3a6f4-6599-48cf-a64c-4da70fca62e1', true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

-- Note: Secrets should be created programmatically with proper encryption
-- This is just a placeholder structure
INSERT INTO "sap_secrets" ("id", "name", "type", "encryptedValue", "description", "isActive", "createdAt", "updatedAt", "accessCount")
VALUES ('eab004a1-b2fe-4de1-85db-8588f37d023c', 'connection-SAP Demo System-password', 'password', 
        '$2b$10$encrypted_password_placeholder', 'Password for connection: SAP Demo System', true, NOW(), NOW(), 0)
ON CONFLICT ("id") DO NOTHING;

-- Update SAP connection to reference the password secret
UPDATE "connections" 
SET "parameters" = jsonb_set("parameters", '{passwordSecretId}', '"eab004a1-b2fe-4de1-85db-8588f37d023c"')
WHERE "id" = '243f0131-145e-4ded-a730-bdbc2dd40fa4';

import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

// Load environment variables
config({ path: ['.env', '../.env', '../../.env'] });

export default defineConfig({
  schema: './src/database/schema/index.ts',
  out: './src/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'joe',
    database: process.env.DB_NAME || 'nestjs_app',
    ssl: false,
  },
  verbose: true,
  strict: true,
});

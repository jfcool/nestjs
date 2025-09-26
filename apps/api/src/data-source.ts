import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from './users/user.entity';
import { Connection } from './sap/entities/sap-connection.entity';
import { SapSecret } from './sap/entities/sap-secret.entity';
import { Conversation } from './chat/entities/conversation.entity';
import { Message } from './chat/entities/message.entity';
import { Role } from './auth/entities/role.entity';
import { DocumentEntity } from './documents/entities/document.entity';
import { ChunkEntity } from './documents/entities/chunk.entity';

// Load environment variables
config({ path: ['.env', '../.env', '../../.env'] });

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'joe',
  database: process.env.DB_NAME || 'nestjs_app',
  entities: [User, Connection, SapSecret, Conversation, Message, Role, DocumentEntity, ChunkEntity],
  migrations: ['src/migrations/*.ts'],
  synchronize: true,
  logging: process.env.NODE_ENV === 'development',
});

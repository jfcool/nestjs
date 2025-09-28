import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { SapModule } from './sap/sap.module';
import { ChatModule } from './chat/chat.module';
import { AuthModule } from './auth/auth.module';
import { PermissionsModule } from './permissions/permissions.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DocumentsModule } from './documents/documents.module';
import { User } from './users/user.entity';
import { Connection } from './sap/entities/sap-connection.entity';
import { SapSecret } from './sap/entities/sap-secret.entity';
import { Conversation } from './chat/entities/conversation.entity';
import { Message } from './chat/entities/message.entity';
import { Role } from './auth/entities/role.entity';
import { DocumentEntity } from './documents/entities/document.entity';
import { ChunkEntity } from './documents/entities/chunk.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env', '../../.env'],
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'joe',
      database: process.env.DB_NAME || 'nestjs_app',
      entities: [User, Connection, SapSecret, Conversation, Message, Role, DocumentEntity, ChunkEntity],
      synchronize: true, // Enable synchronize for now
      logging: process.env.NODE_ENV === 'development',
    }),
    AuthModule,
    PermissionsModule,
    DashboardModule,
    UsersModule,
    SapModule,
    ChatModule,
    DocumentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

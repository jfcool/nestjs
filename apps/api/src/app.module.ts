import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { SapModule } from './sap/sap.module';
import { User } from './users/user.entity';
import { Connection } from './sap/entities/sap-connection.entity';
import { SapSecret } from './sap/entities/sap-secret.entity';
import { seedUsers } from './users/seed-users';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'joe',
      database: process.env.DB_NAME || 'nestjs_app',
      entities: [User, Connection, SapSecret],
      synchronize: process.env.NODE_ENV !== 'production', // Auto-create tables in development
      logging: process.env.NODE_ENV === 'development',
    }),
    UsersModule,
    SapModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements OnModuleInit {
  constructor(private dataSource: DataSource) {}

  async onModuleInit() {
    // Seed users after module initialization
    try {
      await seedUsers(this.dataSource);
    } catch (error) {
      console.error('Error seeding users:', error);
    }
  }
}

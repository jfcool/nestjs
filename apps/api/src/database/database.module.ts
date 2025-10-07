import { Module, Global, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION,
      useFactory: (configService: ConfigService) => {
        const connectionString = `postgres://${configService.get('DB_USERNAME', 'postgres')}:${configService.get('DB_PASSWORD', 'joe')}@${configService.get('DB_HOST', 'localhost')}:${configService.get('DB_PORT', '5432')}/${configService.get('DB_NAME', 'nestjs_app')}`;
        
        const client = postgres(connectionString, {
          max: 10,
          idle_timeout: 20,
          connect_timeout: 10,
        });
        
        return drizzle(client, { schema, logger: configService.get('NODE_ENV') === 'development' });
      },
      inject: [ConfigService],
    },
  ],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule implements OnModuleInit {
  async onModuleInit() {
    console.log('✅ Database connection established with Drizzle ORM');
  }
}

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { SapModule } from './sap/sap.module';

@Module({
  imports: [UsersModule, SapModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

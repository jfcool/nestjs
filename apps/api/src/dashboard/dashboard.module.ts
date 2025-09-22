import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { User } from '../users/user.entity';
import { Conversation } from '../chat/entities/conversation.entity';
import { Connection } from '../sap/entities/sap-connection.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Conversation, Connection]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}

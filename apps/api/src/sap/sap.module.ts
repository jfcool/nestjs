import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SapController } from './sap.controller';
import { SapService } from './sap.service';
import { Connection } from './entities/sap-connection.entity';
import { SapSecret } from './entities/sap-secret.entity';
import { SecretService } from './services/secret.service';
import { ConnectionService } from './services/connection.service';
import { AgentDBService } from './services/agentdb.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Connection, SapSecret]),
  ],
  controllers: [SapController],
  providers: [
    SapService,
    SecretService,
    ConnectionService,
    AgentDBService,
  ],
  exports: [
    SapService,
    SecretService,
    ConnectionService,
    AgentDBService,
  ],
})
export class SapModule {}

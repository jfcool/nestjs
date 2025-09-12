import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SapController } from './sap.controller';
import { SapService } from './sap.service';
import { Connection } from './entities/sap-connection.entity';
import { SapSecret } from './entities/sap-secret.entity';
import { ConnectionService } from './services/connection.service';
import { SecretService } from './services/secret.service';
import { AgentDBService } from './services/agentdb.service';
import { SapCloudSdkService } from './services/sap-cloud-sdk.service';
import { SapCloudSdkLocalService } from './services/sap-cloud-sdk-local.service';

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
    SapCloudSdkService,
    SapCloudSdkLocalService,
  ],
  exports: [
    SapService,
    SecretService,
    ConnectionService,
    AgentDBService,
    SapCloudSdkService,
    SapCloudSdkLocalService,
  ],
})
export class SapModule {}

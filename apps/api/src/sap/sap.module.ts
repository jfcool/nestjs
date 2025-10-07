import { Module } from '@nestjs/common';
import { SapController } from './sap.controller';
import { SapService } from './sap.service';
import { ConnectionService } from './services/connection.service';
import { SecretService } from './services/secret.service';
import { AgentDBService } from './services/agentdb.service';
import { SapCloudSdkService } from './services/sap-cloud-sdk.service';
import { SapCloudSdkLocalService } from './services/sap-cloud-sdk-local.service';

@Module({
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

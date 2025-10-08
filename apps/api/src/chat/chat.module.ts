import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { McpService } from './services/mcp.service';
import { McpClientService } from './services/mcp-client.service';
import { ProactiveMcpService } from './services/proactive-mcp.service';
import { SemanticMcpService } from './services/semantic-mcp.service';
import { GenericSAPFormatterService } from './services/generic-sap-formatter.service';
import { AIModelService } from './services/ai-model.service';
import { AIChainService } from './services/ai-chain.service';
import { AIAgentService } from './services/ai-agent.service';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [DocumentsModule],
  controllers: [ChatController],
  providers: [ChatService, McpService, McpClientService, ProactiveMcpService, SemanticMcpService, GenericSAPFormatterService, AIModelService, AIChainService, AIAgentService],
  exports: [ChatService, McpService, AIModelService],
})
export class ChatModule {}

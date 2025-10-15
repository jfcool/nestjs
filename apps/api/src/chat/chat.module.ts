import { Module, OnModuleInit } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
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
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';

@Module({
  imports: [
    DocumentsModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [ChatController],
  providers: [
    ChatGateway,
    ChatService,
    McpService,
    McpClientService,
    ProactiveMcpService,
    SemanticMcpService,
    GenericSAPFormatterService,
    AIModelService,
    AIChainService,
    AIAgentService,
    WsJwtGuard,
  ],
  exports: [ChatService, McpService, AIModelService],
})
export class ChatModule implements OnModuleInit {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  onModuleInit() {
    // Connect Gateway to Service for broadcasting
    this.chatService.setChatGateway(this.chatGateway);
  }
}

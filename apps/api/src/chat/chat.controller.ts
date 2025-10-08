import { Controller, Get, Post, Body, Param, Delete, Put, NotFoundException, Sse, Res, UseGuards, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags, ApiCreatedResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { ChatService } from './chat.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class ChatController {
  private streamingSubjects = new Map<string, Subject<any>>();

  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  @RequirePermissions('chat')
  @ApiOperation({ operationId: 'getConversations' })
  @ApiOkResponse({ description: 'List of conversations' })
  async getConversations() {
    return this.chatService.getConversations();
  }

  @Post('conversations')
  @RequirePermissions('chat')
  @ApiOperation({ operationId: 'createConversation' })
  @ApiCreatedResponse({ description: 'Created conversation' })
  async createConversation(@Body() dto: CreateConversationDto) {
    return this.chatService.createConversation(dto);
  }

  @Get('conversations/:id')
  @RequirePermissions('chat')
  @ApiOperation({ operationId: 'getConversation' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiOkResponse({ description: 'Conversation details' })
  async getConversation(@Param('id') id: string) {
    return this.chatService.getConversation(id);
  }

  @Delete('conversations/:id')
  @RequirePermissions('chat')
  @ApiOperation({ operationId: 'deleteConversation' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiOkResponse({ type: 'boolean' })
  async deleteConversation(@Param('id') id: string): Promise<{ deleted: boolean }> {
    const deleted = await this.chatService.deleteConversation(id);
    if (!deleted) {
      throw new NotFoundException(`Conversation with ID ${id} not found`);
    }
    return { deleted };
  }

  @Put('conversations/:id')
  @RequirePermissions('chat')
  @ApiOperation({ operationId: 'updateConversation' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiOkResponse({ description: 'Updated conversation' })
  async updateConversation(
    @Param('id') id: string,
    @Body() updateData: { title?: string }
  ) {
    return this.chatService.updateConversation(id, updateData);
  }

  @Post('messages')
  @RequirePermissions('chat')
  @ApiOperation({ operationId: 'sendMessage' })
  @ApiCreatedResponse({ 
    description: 'Message sent and response generated'
  })
  async sendMessage(@Body() dto: SendMessageDto, @Req() req: any) {
    // Extract JWT token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    return this.chatService.sendMessage(dto, token);
  }

  @Get('mcp/servers')
  @RequirePermissions('chat')
  @ApiOperation({ operationId: 'getMcpServers' })
  @ApiOkResponse({ 
    description: 'List of available MCP servers',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          url: { type: 'string' },
          description: { type: 'string' },
          tools: { type: 'array' },
          resources: { type: 'array' }
        }
      }
    }
  })
  async getMcpServers() {
    return this.chatService.getMcpServers();
  }

  @Post('mcp/reload')
  @RequirePermissions('chat')
  @ApiOperation({ operationId: 'reloadMcpConfiguration' })
  @ApiOkResponse({ 
    description: 'Reload MCP server configuration',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' }
      }
    }
  })
  async reloadMcpConfiguration() {
    try {
      await this.chatService.reloadMcpConfiguration();
      return { success: true, message: 'MCP configuration reloaded successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  @Post('mcp/execute')
  @RequirePermissions('chat')
  @ApiOperation({ operationId: 'executeMcpTool' })
  @ApiOkResponse({ 
    description: 'MCP tool execution result',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        result: { type: 'object' },
        error: { type: 'string' }
      }
    }
  })
  async executeMcpTool(@Body() body: { serverName: string; toolName: string; arguments: any }) {
    return this.chatService.executeMcpTool(body.serverName, body.toolName, body.arguments);
  }

  @Get('models')
  @RequirePermissions('chat')
  @ApiOperation({ operationId: 'getAvailableModels' })
  @ApiOkResponse({ 
    description: 'List of available AI models',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          provider: { type: 'string' },
          description: { type: 'string' },
          enabled: { type: 'boolean' }
        }
      }
    }
  })
  async getAvailableModels() {
    return this.chatService.getAvailableModels();
  }

  @Get('models/default')
  @RequirePermissions('chat')
  @ApiOperation({ operationId: 'getDefaultModel' })
  @ApiOkResponse({ 
    description: 'Default AI model configuration',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        provider: { type: 'string' },
        description: { type: 'string' }
      }
    }
  })
  async getDefaultModel() {
    return this.chatService.getDefaultModel();
  }

  @Post('models/default')
  @RequirePermissions('chat')
  @ApiOperation({ operationId: 'setDefaultModel' })
  @ApiOkResponse({ 
    description: 'Set default AI model',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' }
      }
    }
  })
  async setDefaultModel(@Body() body: { modelId: string }) {
    const success = await this.chatService.setDefaultModel(body.modelId);
    return { success };
  }

  @Get('providers')
  @RequirePermissions('chat')
  @ApiOperation({ operationId: 'getProviders' })
  @ApiOkResponse({ 
    description: 'List of AI model providers',
    schema: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          website: { type: 'string' },
          apiKeyRequired: { type: 'boolean' },
          apiKeyEnv: { type: 'string' }
        }
      }
    }
  })
  async getProviders() {
    return this.chatService.getProviders();
  }

  @Post('models/reload')
  @RequirePermissions('chat')
  @ApiOperation({ operationId: 'reloadModels' })
  @ApiOkResponse({ 
    description: 'Reload AI model configuration',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' }
      }
    }
  })
  async reloadModels() {
    try {
      await this.chatService.reloadConfiguration();
      return { success: true, message: 'Configuration reloaded successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  @Get('models/all')
  @RequirePermissions('chat')
  @ApiOperation({ operationId: 'getAllModels' })
  @ApiOkResponse({ 
    description: 'List of all AI models (including disabled ones)',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          provider: { type: 'string' },
          description: { type: 'string' },
          enabled: { type: 'boolean' },
          maxTokens: { type: 'number' },
          temperature: { type: 'number' }
        }
      }
    }
  })
  async getAllModels() {
    return this.chatService.getAllModels();
  }

  @Get('messages/stream/:sessionId')
  @RequirePermissions('chat')
  @ApiOperation({ operationId: 'streamMessage' })
  streamMessage(@Param('sessionId') sessionId: string, @Res() res: any): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const subject = new Subject();
    this.streamingSubjects.set(sessionId, subject);
    
    const subscription = subject.asObservable().subscribe({
      next: (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      },
      complete: () => {
        res.end();
        subscription.unsubscribe();
      },
      error: (error) => {
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.end();
        subscription.unsubscribe();
      }
    });

    // Clean up on client disconnect
    res.on('close', () => {
      subscription.unsubscribe();
      this.streamingSubjects.delete(sessionId);
    });
  }

  @Post('messages/stream')
  @RequirePermissions('chat')
  @ApiOperation({ operationId: 'sendStreamingMessage' })
  async sendStreamingMessage(@Body() dto: SendMessageDto & { sessionId: string }, @Req() req: any): Promise<{ sessionId: string }> {
    const sessionId = dto.sessionId || Date.now().toString();
    const subject = this.streamingSubjects.get(sessionId);
    
    if (!subject) {
      throw new NotFoundException(`Streaming session ${sessionId} not found`);
    }

    // Send immediate confirmation that user message was received
    subject.next({
      type: 'user_message',
      content: dto.content,
      timestamp: new Date().toISOString()
    });

    // Extract JWT token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

    // Process message asynchronously
    this.processStreamingMessage(dto, sessionId, subject, token);
    
    return { sessionId };
  }

  private async processStreamingMessage(dto: SendMessageDto, sessionId: string, subject: Subject<any>, token?: string) {
    try {
      // Send processing status
      subject.next({
        type: 'status',
        message: 'Verarbeite Ihre Anfrage...',
        timestamp: new Date().toISOString()
      });

      // Simulate MCP tool analysis
      if (dto.useMcp) {
        subject.next({
          type: 'status',
          message: 'Analysiere verfügbare MCP-Tools...',
          timestamp: new Date().toISOString()
        });
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Send AI processing status
      subject.next({
        type: 'status',
        message: 'Generiere AI-Antwort...',
        timestamp: new Date().toISOString()
      });

      // Get the actual response
      const result = await this.chatService.sendMessage(dto, token);
      
      // Stream the response word by word
      const words = result.assistantMessage.content.split(' ');
      let streamedContent = '';
      
      for (let i = 0; i < words.length; i++) {
        streamedContent += (i > 0 ? ' ' : '') + words[i];
        
        subject.next({
          type: 'assistant_message_chunk',
          content: streamedContent,
          isComplete: i === words.length - 1,
          timestamp: new Date().toISOString()
        });
        
        // Small delay between words for streaming effect
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Send final complete message
      subject.next({
        type: 'complete',
        userMessage: result.userMessage,
        assistantMessage: result.assistantMessage,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      subject.next({
        type: 'error',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    } finally {
      // Clean up after 30 seconds
      setTimeout(() => {
        subject.complete();
        this.streamingSubjects.delete(sessionId);
      }, 30000);
    }
  }
}

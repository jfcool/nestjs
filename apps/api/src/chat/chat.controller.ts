import { Controller, Get, Post, Body, Param, Delete, NotFoundException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags, ApiCreatedResponse, ApiParam } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  @ApiOperation({ operationId: 'getConversations' })
  @ApiOkResponse({ type: Conversation, isArray: true })
  async getConversations(): Promise<Conversation[]> {
    return this.chatService.getConversations();
  }

  @Post('conversations')
  @ApiOperation({ operationId: 'createConversation' })
  @ApiCreatedResponse({ type: Conversation })
  async createConversation(@Body() dto: CreateConversationDto): Promise<Conversation> {
    return this.chatService.createConversation(dto);
  }

  @Get('conversations/:id')
  @ApiOperation({ operationId: 'getConversation' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiOkResponse({ type: Conversation })
  async getConversation(@Param('id') id: string): Promise<Conversation> {
    return this.chatService.getConversation(id);
  }

  @Delete('conversations/:id')
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

  @Post('messages')
  @ApiOperation({ operationId: 'sendMessage' })
  @ApiCreatedResponse({ 
    description: 'Message sent and response generated',
    schema: {
      type: 'object',
      properties: {
        userMessage: { $ref: '#/components/schemas/Message' },
        assistantMessage: { $ref: '#/components/schemas/Message' }
      }
    }
  })
  async sendMessage(@Body() dto: SendMessageDto): Promise<{ userMessage: Message; assistantMessage: Message }> {
    return this.chatService.sendMessage(dto);
  }

  @Get('mcp/servers')
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
}

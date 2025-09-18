import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message, MessageRole } from './entities/message.entity';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { McpService, McpToolCall } from './services/mcp.service';
import { ProactiveMcpService } from './services/proactive-mcp.service';
import { SemanticMcpService } from './services/semantic-mcp.service';
import { AIModelService, ChatMessage } from './services/ai-model.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    private mcpService: McpService,
    private proactiveMcpService: ProactiveMcpService,
    private semanticMcpService: SemanticMcpService,
    private aiModelService: AIModelService,
  ) {}

  async createConversation(dto: CreateConversationDto): Promise<Conversation> {
    const conversation = this.conversationRepository.create({
      title: dto.title,
      model: dto.model || 'gpt-4',
      systemPrompt: dto.systemPrompt,
      mcpServers: dto.mcpServers || [],
    });

    return this.conversationRepository.save(conversation);
  }

  async getConversations(): Promise<Conversation[]> {
    return this.conversationRepository.find({
      relations: ['messages'],
      order: { createdAt: 'DESC' },
    });
  }

  async getConversation(id: string): Promise<Conversation> {
    const conversation = await this.conversationRepository.findOne({
      where: { id },
      relations: ['messages'],
      order: { messages: { createdAt: 'ASC' } },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation with ID ${id} not found`);
    }

    return conversation;
  }

  async deleteConversation(id: string): Promise<boolean> {
    const result = await this.conversationRepository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async updateConversation(id: string, updateData: { title?: string }): Promise<Conversation> {
    const conversation = await this.conversationRepository.findOne({
      where: { id },
      relations: ['messages'],
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation with ID ${id} not found`);
    }

    if (updateData.title !== undefined) {
      conversation.title = updateData.title;
    }

    await this.conversationRepository.save(conversation);
    return conversation;
  }

  async sendMessage(dto: SendMessageDto): Promise<{ userMessage: Message; assistantMessage: Message }> {
    let conversation: Conversation;
    let isNewConversation = false;

    if (dto.conversationId) {
      conversation = await this.getConversation(dto.conversationId);
    } else {
      // Create a new conversation if none specified
      // Start with a temporary title, we'll update it after getting the AI response
      conversation = await this.createConversation({
        title: 'New Conversation',
        model: this.aiModelService.getDefaultModel().id,
      });
      isNewConversation = true;
    }

    // Save user message
    const userMessage = this.messageRepository.create({
      content: dto.content,
      role: dto.role,
      conversationId: conversation.id,
    });
    await this.messageRepository.save(userMessage);

    // Generate assistant response
    const assistantResponse = await this.generateResponse(conversation, dto);

    // Save assistant message
    const assistantMessage = this.messageRepository.create({
      content: assistantResponse.content,
      role: MessageRole.ASSISTANT,
      conversationId: conversation.id,
      mcpToolCalls: assistantResponse.mcpToolCalls,
    });
    await this.messageRepository.save(assistantMessage);

    // Generate smart title for new conversations OR existing conversations that still have the default title
    const shouldGenerateTitle = isNewConversation || 
      (conversation.title === 'New Conversation' && conversation.messages?.length <= 2);
    
    if (shouldGenerateTitle) {
      try {
        this.logger.log(`Generating smart title for conversation ${conversation.id} (isNew: ${isNewConversation}, currentTitle: "${conversation.title}")`);
        
        // Get the first user message from the conversation
        const allMessages = await this.messageRepository.find({
          where: { conversationId: conversation.id },
          order: { createdAt: 'ASC' },
        });
        
        const firstUserMessage = allMessages.find(msg => msg.role === MessageRole.USER);
        const firstUserContent = firstUserMessage ? firstUserMessage.content : dto.content;
        
        this.logger.log(`Using first user message for title generation: "${firstUserContent.substring(0, 50)}..."`);
        
        const smartTitle = await this.generateSmartTitleFromConversation(
          firstUserContent, 
          assistantResponse.content
        );
        await this.updateConversation(conversation.id, { title: smartTitle });
        conversation.title = smartTitle;
        this.logger.log(`Successfully updated conversation title to: "${smartTitle}"`);
      } catch (error) {
        this.logger.error(`Failed to generate smart title: ${error.message}`, error.stack);
      }
    }

    return { userMessage, assistantMessage };
  }

  private async generateResponse(
    conversation: Conversation,
    dto: SendMessageDto,
  ): Promise<{ content: string; mcpToolCalls?: any[] }> {
    try {
      // Get conversation history
      const messages = await this.messageRepository.find({
        where: { conversationId: conversation.id },
        order: { createdAt: 'ASC' },
      });

      // Convert to ChatMessage format for AI model
      const chatMessages: ChatMessage[] = [];
      
      // Add system prompt if available, or default proactive MCP prompt
      const systemPrompt = conversation.systemPrompt || this.getDefaultSystemPrompt();
      if (systemPrompt) {
        chatMessages.push({
          role: 'system',
          content: systemPrompt,
        });
      }

      // Add conversation history
      messages.forEach(msg => {
        chatMessages.push({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        });
      });

      // Handle MCP tools proactively if enabled
      let mcpToolCalls: any[] = [];
      if (dto.useMcp && conversation.mcpServers?.length > 0) {
        // Get available (enabled) servers
        const availableServers = await this.mcpService.getAvailableServers();
        const enabledServerNames = availableServers.map(server => server.name);
        
        // Only use servers that are both in the conversation AND currently enabled
        const activeServers = conversation.mcpServers.filter(serverName => 
          enabledServerNames.includes(serverName)
        );

        // Use semantic MCP service for intelligent tool discovery and execution
        try {
          this.logger.log(`Semantically analyzing user input: "${dto.content}" with active servers: ${activeServers.join(', ')}`);
          
          const semanticResults = await this.semanticMcpService.analyzeAndExecuteSemanticTools(
            dto.content,
            activeServers,
            true // auto-execute enabled tools
          );

          if (semanticResults.length > 0) {
            this.logger.log(`Semantic MCP executed ${semanticResults.length} tools successfully`);
            mcpToolCalls = semanticResults;
          } else {
            this.logger.debug('No semantic MCP tools were executed, falling back to proactive approach');
            
            // Fallback to proactive approach if semantic analysis doesn't find anything
            const proactiveResults = await this.proactiveMcpService.analyzeAndExecuteProactiveTools(
              dto.content,
              activeServers,
              true
            );
            
            if (proactiveResults.length > 0) {
              this.logger.log(`Fallback proactive MCP executed ${proactiveResults.length} tools successfully`);
              mcpToolCalls = proactiveResults;
            }
          }
        } catch (error) {
          this.logger.error(`Semantic MCP execution failed: ${error.message}`);
          // Fallback: still provide a helpful response even if MCP tools fail
          mcpToolCalls = [{
            toolCall: { serverName: 'system', toolName: 'error', arguments: {} },
            result: { error: `MCP tools temporarily unavailable: ${error.message}` }
          }];
        }
      }

      // Generate AI response using the configured model
      const aiResponse = await this.aiModelService.generateResponse(
        chatMessages,
        conversation.model,
        mcpToolCalls
      );

      return {
        content: aiResponse.content,
        mcpToolCalls: mcpToolCalls.length > 0 ? mcpToolCalls : undefined,
      };
    } catch (error) {
      this.logger.error(`Error generating response: ${error.message}`);
      return {
        content: 'I apologize, but I encountered an error while processing your request. Please try again.',
      };
    }
  }

  async getMcpServers() {
    return this.mcpService.getAllServersWithStatus();
  }

  async reloadMcpConfiguration() {
    return this.mcpService.reloadConfiguration();
  }

  async executeMcpTool(serverName: string, toolName: string, arguments_: any) {
    return this.mcpService.executeTool({ serverName, toolName, arguments: arguments_ });
  }

  async getAvailableModels() {
    return this.aiModelService.getAvailableModels();
  }

  async getDefaultModel() {
    return this.aiModelService.getDefaultModel();
  }

  async setDefaultModel(modelId: string) {
    return this.aiModelService.setDefaultModel(modelId);
  }

  async getProviders() {
    return this.aiModelService.getProviders();
  }

  async reloadConfiguration() {
    return this.aiModelService.reloadConfiguration();
  }

  async getAllModels() {
    return this.aiModelService.getAllModels();
  }

  private getDefaultSystemPrompt(): string {
    return `You are an intelligent AI assistant with access to MCP (Model Context Protocol) tools that allow you to interact with various systems including SAP ABAP systems and databases.

IMPORTANT: You should proactively use available MCP tools when they can help answer the user's questions. Don't wait for explicit requests - if the user asks about SAP data, tables, objects, or database information, immediately use the appropriate MCP tools to provide accurate, real-time information.

Available capabilities:
- SAP ABAP system access via mcp-abap-abap-adt-api (table contents, object search, source code, etc.)
- Database queries via agentdb (natural language queries, SQL execution)
- Real-time data retrieval and analysis

When users ask about:
- SAP tables (like VBAK, VBAP, etc.) → Use tableContents tool immediately
- SAP objects or classes → Use searchObject or classComponents tools
- Database information → Use appropriate database query tools
- Any technical data → Proactively fetch real data instead of giving generic responses

Always provide specific, data-driven answers based on the actual MCP tool results rather than generic responses.`;
  }

  private async generateSmartTitle(firstMessage: string): Promise<string> {
    try {
      // Use AI to generate a concise title based on the first message
      const titlePrompt = `Generate a short, descriptive title (max 50 characters) for a conversation that starts with this message: "${firstMessage}". 
      The title should be concise and capture the main topic or intent. Return only the title, no quotes or extra text.`;

      const titleResponse = await this.aiModelService.generateResponse(
        [{ role: 'user', content: titlePrompt }],
        'claude-3-5-haiku-20241022', // Use a fast model for title generation
        []
      );

      let title = titleResponse.content.trim();
      
      // Clean up the title - remove quotes if present
      title = title.replace(/^["']|["']$/g, '');
      
      // Ensure it's not too long
      if (title.length > 50) {
        title = title.substring(0, 47) + '...';
      }

      // Fallback to simple truncation if AI title is empty or too generic
      if (!title || title.length < 5 || title.toLowerCase().includes('conversation') || title.toLowerCase().includes('chat')) {
        title = firstMessage.substring(0, 47) + (firstMessage.length > 47 ? '...' : '');
      }

      return title;
    } catch (error) {
      this.logger.warn(`Failed to generate smart title: ${error.message}`);
      // Fallback to simple truncation
      return firstMessage.substring(0, 47) + (firstMessage.length > 47 ? '...' : '');
    }
  }

  private async generateSmartTitleFromConversation(userMessage: string, aiResponse: string): Promise<string> {
    try {
      // Use AI to generate a concise title based on both the user question and AI response
      const titlePrompt = `Generate a short, descriptive title (max 50 characters) for a conversation based on this exchange:

User: "${userMessage}"
Assistant: "${aiResponse.substring(0, 200)}..."

The title should capture the main topic or question being discussed. Be specific and descriptive. Return only the title, no quotes or extra text.`;

      // Use a fast model for title generation, fallback to default if not available
      let modelForTitle = 'claude-3-5-haiku-20241022';
      try {
        // Check if the fast model is available
        const availableModels = this.aiModelService.getAvailableModels();
        const fastModel = availableModels.find(m => m.id === modelForTitle);
        if (!fastModel) {
          // Fallback to default model
          modelForTitle = this.aiModelService.getDefaultModel().id;
        }
      } catch (error) {
        // Use default model if there's any issue
        modelForTitle = this.aiModelService.getDefaultModel().id;
      }

      const titleResponse = await this.aiModelService.generateResponse(
        [{ role: 'user', content: titlePrompt }],
        modelForTitle,
        []
      );

      let title = titleResponse.content.trim();
      
      // Clean up the title - remove quotes if present
      title = title.replace(/^["']|["']$/g, '');
      
      // Ensure it's not too long
      if (title.length > 50) {
        title = title.substring(0, 47) + '...';
      }

      // Fallback to simple truncation if AI title is empty or too generic
      if (!title || title.length < 5 || title.toLowerCase().includes('conversation') || title.toLowerCase().includes('chat')) {
        title = userMessage.substring(0, 47) + (userMessage.length > 47 ? '...' : '');
      }

      this.logger.log(`Generated smart title: "${title}" for conversation starting with: "${userMessage.substring(0, 50)}..."`);
      return title;
    } catch (error) {
      this.logger.warn(`Failed to generate smart title from conversation: ${error.message}`);
      // Fallback to simple truncation of user message
      return userMessage.substring(0, 47) + (userMessage.length > 47 ? '...' : '');
    }
  }
}

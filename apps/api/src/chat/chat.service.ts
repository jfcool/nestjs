import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import { eq, desc, asc } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DATABASE_CONNECTION } from '../database/database.module';
import * as schema from '../database/schema';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { McpService, McpToolCall } from './services/mcp.service';
import { ProactiveMcpService } from './services/proactive-mcp.service';
import { SemanticMcpService } from './services/semantic-mcp.service';
import { AIModelService, ChatMessage } from './services/ai-model.service';
import { DocumentRetrievalService } from '../documents/services/document-retrieval.service';

// Re-export MessageRole enum for compatibility
export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private mcpService: McpService,
    private proactiveMcpService: ProactiveMcpService,
    private semanticMcpService: SemanticMcpService,
    private aiModelService: AIModelService,
    private documentRetrievalService: DocumentRetrievalService,
  ) {}

  async createConversation(dto: CreateConversationDto) {
    const [conversation] = await this.db
      .insert(schema.conversations)
      .values({
        title: dto.title,
        model: dto.model || 'gpt-4',
        systemPrompt: dto.systemPrompt ?? null,
        mcpServers: dto.mcpServers || [],
      })
      .returning();

    return conversation;
  }

  async getConversations() {
    return await this.db.query.conversations.findMany({
      orderBy: [desc(schema.conversations.createdAt)],
      with: {
        messages: {
          orderBy: [asc(schema.messages.createdAt)],
        },
      },
    });
  }

  async getConversation(id: string) {
    const conversation = await this.db.query.conversations.findFirst({
      where: eq(schema.conversations.id, id),
      with: {
        messages: {
          orderBy: [asc(schema.messages.createdAt)],
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation with ID ${id} not found`);
    }

    return conversation;
  }

  async deleteConversation(id: string): Promise<boolean> {
    const result = await this.db
      .delete(schema.conversations)
      .where(eq(schema.conversations.id, id))
      .returning();
    
    return result.length > 0;
  }

  async updateConversation(id: string, updateData: { title?: string }) {
    const conversation = await this.db.query.conversations.findFirst({
      where: eq(schema.conversations.id, id),
      with: {
        messages: {
          orderBy: [asc(schema.messages.createdAt)],
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation with ID ${id} not found`);
    }

    if (updateData.title !== undefined) {
      const [updated] = await this.db
        .update(schema.conversations)
        .set({ title: updateData.title })
        .where(eq(schema.conversations.id, id))
        .returning();
      
      return { ...updated, messages: conversation.messages };
    }

    return conversation;
  }

  async sendMessage(dto: SendMessageDto, authToken?: string): Promise<{ userMessage: any; assistantMessage: any }> {
    let conversation: schema.Conversation;
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
    const [userMessage] = await this.db
      .insert(schema.messages)
      .values({
        content: dto.content,
        role: dto.role as any,
        conversationId: conversation.id,
      })
      .returning();

      // Generate assistant response
      const assistantResponse = await this.generateResponse(conversation, dto, authToken);

    // Save assistant message
    const [assistantMessage] = await this.db
      .insert(schema.messages)
      .values({
        content: assistantResponse.content,
        role: 'assistant' as any,
        conversationId: conversation.id,
        mcpToolCalls: assistantResponse.mcpToolCalls ?? null,
      })
      .returning();

    // Generate smart title for new conversations OR existing conversations that still have the default title
    const conversationMessages = (conversation as any).messages || [];
    const shouldGenerateTitle = isNewConversation || 
      (conversation.title === 'New Conversation' && conversationMessages.length <= 2);
    
    if (shouldGenerateTitle) {
      try {
        this.logger.log(`Generating smart title for conversation ${conversation.id} (isNew: ${isNewConversation}, currentTitle: "${conversation.title}")`);
        
        // Get the first user message from the conversation
        const allMessages = await this.db
          .select()
          .from(schema.messages)
          .where(eq(schema.messages.conversationId, conversation.id))
          .orderBy(asc(schema.messages.createdAt));
        
        const firstUserMessage = allMessages.find(msg => msg.role === 'user');
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
    conversation: schema.Conversation,
    dto: SendMessageDto,
    authToken?: string,
  ): Promise<{ content: string; mcpToolCalls?: any[] }> {
    try {
      // Get conversation history
      const messages = await this.db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, conversation.id))
        .orderBy(asc(schema.messages.createdAt));

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
      const mcpServers = conversation.mcpServers || [];
      if (dto.useMcp && mcpServers.length > 0) {
        // Get available (enabled) servers
        const availableServers = await this.mcpService.getAvailableServers();
        const enabledServerNames = availableServers.map(server => server.name);
        
        // Only use servers that are both in the conversation AND currently enabled
        const activeServers = mcpServers.filter(serverName => 
          enabledServerNames.includes(serverName)
        );

        // Use semantic MCP service for intelligent tool discovery and execution
        try {
          this.logger.log(`Semantically analyzing user input: "${dto.content}" with active servers: ${activeServers.join(', ')}`);
          
          // Extract conversation history for context (last 5 messages)
          const conversationHistory = messages
            .slice(-5)
            .map(msg => msg.content);
          
          const semanticResults = await this.semanticMcpService.analyzeAndExecuteSemanticTools(
            dto.content,
            activeServers,
            true, // auto-execute enabled tools
            authToken,
            conversationHistory // Pass conversation history for context
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
              true,
              authToken
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
    return `You are an intelligent AI assistant with access to MCP (Model Context Protocol) tools for various data sources and systems.

AVAILABLE MCP TOOLS:
- Document search and retrieval via document-retrieval server (search_documents, get_document_context, get_document_stats)
- SAP ABAP system access via mcp-abap-abap-adt-api (table contents, object search, source code, etc.)
- Database queries via agentdb (natural language queries, SQL execution)

DOCUMENT ACCESS:
- Use the document-retrieval MCP tools to search through indexed documents
- Available tools: search_documents, get_document_context, get_document_stats, index_document
- The system will automatically detect document-related queries and use appropriate MCP tools
- You receive formatted results with document paths, content, and relevance scores

RESPONSE GUIDELINES:
1. For document questions: Use document-retrieval MCP tools and analyze the results
2. For SAP/database questions: Use appropriate MCP tools proactively  
3. Always provide specific, data-driven answers based on actual MCP tool results
4. Be confident and direct in your responses based on the provided data
5. Use MCP tools proactively when they can help answer user questions

All data access goes through MCP tools for consistent, reliable results.`;
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

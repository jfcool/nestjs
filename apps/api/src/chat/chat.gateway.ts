import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';

/**
 * WebSocket Gateway for real-time chat with AI streaming
 * Handles bidirectional communication for chat features
 */
@WebSocketGateway({
  cors: {
    origin: true, // Allow all origins for WebSocket connections
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  
  // Track which conversations each socket is in: Map<socketId, Set<conversationId>>
  private socketConversations = new Map<string, Set<string>>();
  
  // Track socket to user mapping: Map<socketId, {userId: string, username: string}>
  private socketUsers = new Map<string, { userId: string; username: string }>();

  constructor(private readonly chatService: ChatService) {}

  /**
   * Broadcast conversations list update to all connected clients
   */
  async broadcastConversationsUpdate() {
    try {
      const conversations = await this.chatService.getAllConversations();
      this.server.emit('chat:conversations-updated', {
        conversations,
        timestamp: new Date().toISOString(),
      });
      this.logger.log('Broadcasted conversations update to all clients');
    } catch (error) {
      this.logger.error(`Error broadcasting conversations update: ${error.message}`);
    }
  }

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    const userInfo = this.socketUsers.get(client.id);
    const conversationIds = this.socketConversations.get(client.id);
    
    if (userInfo && conversationIds) {
      // Remove user from all conversations they were in
      for (const conversationId of conversationIds) {
        try {
          await this.chatService.removeActiveUser(conversationId, userInfo.userId);
          
          // Get updated active users and broadcast
          const activeUsers = await this.chatService.getActiveUsers(conversationId);
          this.server.to(conversationId).emit('chat:presence-update', {
            conversationId,
            activeUsers,
          });
          
          // Notify others that user left
          client.to(conversationId).emit('chat:user-left', {
            userId: userInfo.userId,
            username: userInfo.username,
          });
        } catch (error) {
          this.logger.error(`Error removing user from conversation ${conversationId}: ${error.message}`);
        }
      }
    }
    
    // Clean up tracking
    this.socketConversations.delete(client.id);
    this.socketUsers.delete(client.id);
  }

  /**
   * Handle chat message with streaming response
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('chat:send')
  async handleChatMessage(
    @MessageBody() data: SendMessageDto & { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;
    
    this.logger.log(
      `User ${user.username} sent message in conversation ${data.conversationId}`,
    );

    try {
      // IMMEDIATELY broadcast the user's message to everyone (before AI responds)
      this.server.to(data.conversationId).emit('chat:user-message-sent', {
        conversationId: data.conversationId,
        userId: user.sub,
        username: user.username,
        content: data.content,
        timestamp: new Date().toISOString(),
      });

      // Broadcast thinking event to all users in conversation
      this.server.to(data.conversationId).emit('chat:thinking', {
        conversationId: data.conversationId,
        status: 'processing',
        userId: user.sub,
        username: user.username,
      });

      // Process message with streaming
      await this.streamChatResponse(
        client,
        data.conversationId,
        data.content,
        user.sub,
        user.username,
      );
    } catch (error) {
      this.logger.error(`Error processing chat message: ${error.message}`);
      this.server.to(data.conversationId).emit('chat:error', {
        conversationId: data.conversationId,
        error: error.message,
      });
    }
  }

  /**
   * Stream AI response token by token using real Claude API streaming
   */
  private async streamChatResponse(
    client: Socket,
    conversationId: string,
    userMessage: string,
    userId: string,
    username: string,
  ) {
    try {
      // Verify conversation exists
      const conversation = await this.chatService.getConversation(
        conversationId,
      );

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Use the real streaming method from chatService
      const messageId = `msg_${Date.now()}`;
      let fullContent = '';

      // Start streaming - broadcast to ALL users in conversation
      for await (const chunk of this.chatService.streamMessage(
        {
          conversationId,
          content: userMessage,
          role: 'user',
        },
        undefined, // authToken
        userId,
        username,
      )) {
        fullContent += chunk;
        
        // Broadcast streaming chunks to ALL users in conversation
        this.server.to(conversationId).emit('chat:streaming', {
          conversationId,
          messageId,
          chunk,
          isComplete: false,
        });
      }

      // Broadcast completion to ALL
      this.server.to(conversationId).emit('chat:streaming', {
        conversationId,
        messageId,
        chunk: '',
        isComplete: true,
      });

      // Get the updated conversation with all messages
      const updatedConversation = await this.chatService.getConversation(conversationId);
      
      // Find the latest assistant message (the one we just streamed)
      const messages = updatedConversation.messages || [];
      const latestAssistantMessage = messages
        .filter(m => m.role === 'assistant')
        .pop();
      
      // Find the user message that was just sent (last one with this user's ID)
      const latestUserMessage = messages
        .filter(m => m.role === 'user')
        .reverse()
        .find(m => m.userId === userId && m.content === userMessage);
      
      // IMPORTANT: Always broadcast the user message FIRST
      if (latestUserMessage) {
        this.server.to(conversationId).emit('chat:message', {
          conversationId,
          message: latestUserMessage,
        });
      }
      
      if (latestAssistantMessage) {
        // Broadcast the complete assistant message to ALL users
        this.server.to(conversationId).emit('chat:message', {
          conversationId,
          message: latestAssistantMessage,
        });
      }

      this.server.to(conversationId).emit('chat:complete', {
        conversationId,
        messageId,
      });
    } catch (error) {
      this.logger.error(`Streaming error: ${error.message}`);
      throw error;
    }
  }


  /**
   * Handle typing indicator
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('chat:typing')
  async handleTyping(
    @MessageBody() data: { conversationId: string; isTyping: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;
    
    // Broadcast typing status to other users in the conversation
    client.to(data.conversationId).emit('chat:user-typing', {
      userId: user.sub,
      username: user.username,
      isTyping: data.isTyping,
    });
  }

  /**
   * Join a conversation room
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('chat:join')
  async handleJoinConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;
    
    await client.join(data.conversationId);
    
    // Track this socket's user info
    this.socketUsers.set(client.id, {
      userId: user.sub,
      username: user.username,
    });
    
    // Track which conversations this socket is in
    if (!this.socketConversations.has(client.id)) {
      this.socketConversations.set(client.id, new Set());
    }
    this.socketConversations.get(client.id)!.add(data.conversationId);
    
    // Add user to conversation's active users list
    await this.chatService.addActiveUser(
      data.conversationId,
      user.sub,
      user.username,
    );
    
    this.logger.log(
      `User ${user.username} joined conversation ${data.conversationId}`,
    );

    // Get all active users
    const activeUsers = await this.chatService.getActiveUsers(data.conversationId);

    // Notify the joining user
    client.emit('chat:joined', {
      conversationId: data.conversationId,
      activeUsers,
    });

    // Broadcast presence update to all users in the conversation
    this.server.to(data.conversationId).emit('chat:presence-update', {
      conversationId: data.conversationId,
      activeUsers,
    });

    // Notify others that user joined
    client.to(data.conversationId).emit('chat:user-joined', {
      userId: user.sub,
      username: user.username,
    });
  }

  /**
   * Leave a conversation room
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('chat:leave')
  async handleLeaveConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;
    
    await client.leave(data.conversationId);
    
    // Remove from tracking
    const conversations = this.socketConversations.get(client.id);
    if (conversations) {
      conversations.delete(data.conversationId);
    }
    
    // Remove user from conversation's active users list
    await this.chatService.removeActiveUser(data.conversationId, user.sub);
    
    this.logger.log(
      `User ${user.username} left conversation ${data.conversationId}`,
    );

    // Get updated active users
    const activeUsers = await this.chatService.getActiveUsers(data.conversationId);

    // Broadcast presence update to remaining users
    this.server.to(data.conversationId).emit('chat:presence-update', {
      conversationId: data.conversationId,
      activeUsers,
    });

    // Notify others that user left
    client.to(data.conversationId).emit('chat:user-left', {
      userId: user.sub,
      username: user.username,
    });
  }

  /**
   * Get active users in a conversation
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('chat:get-active-users')
  async handleGetActiveUsers(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const activeUsers = await this.chatService.getActiveUsers(data.conversationId);
    
    client.emit('chat:active-users', {
      conversationId: data.conversationId,
      activeUsers,
    });
  }
}

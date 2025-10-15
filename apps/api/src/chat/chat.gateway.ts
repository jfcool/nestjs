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
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
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

  constructor(private readonly chatService: ChatService) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
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
      // Emit thinking event
      client.emit('chat:thinking', {
        conversationId: data.conversationId,
        status: 'processing',
      });

      // Process message with streaming
      await this.streamChatResponse(
        client,
        data.conversationId,
        data.content,
        user.sub,
      );
    } catch (error) {
      this.logger.error(`Error processing chat message: ${error.message}`);
      client.emit('chat:error', {
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

      // Start streaming
      for await (const chunk of this.chatService.streamMessage({
        conversationId,
        content: userMessage,
        role: 'user',
      })) {
        fullContent += chunk;
        
        // Emit streaming chunks
        client.emit('chat:streaming', {
          conversationId,
          messageId,
          chunk,
          isComplete: false,
        });
      }

      // Emit completion
      client.emit('chat:streaming', {
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
      
      if (latestAssistantMessage) {
        // Emit the complete message so it's permanently saved in frontend
        client.emit('chat:message', {
          conversationId,
          message: latestAssistantMessage,
        });
      }

      client.emit('chat:complete', {
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
    
    this.logger.log(
      `User ${user.username} joined conversation ${data.conversationId}`,
    );

    client.emit('chat:joined', {
      conversationId: data.conversationId,
    });

    // Notify others
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
    
    this.logger.log(
      `User ${user.username} left conversation ${data.conversationId}`,
    );

    // Notify others
    client.to(data.conversationId).emit('chat:user-left', {
      userId: user.sub,
      username: user.username,
    });
  }
}

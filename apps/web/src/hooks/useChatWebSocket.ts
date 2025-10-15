import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  conversationId: string;
  createdAt: string;
  mcpToolCalls?: any[];
}

interface UseChatWebSocketOptions {
  conversationId: string | null;
  token: string | null;
  onMessage?: (message: ChatMessage) => void;
  onError?: (error: string) => void;
}

export function useChatWebSocket({ 
  conversationId, 
  token,
  onMessage,
  onError 
}: UseChatWebSocketOptions) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!token) {
      console.log('No token, skipping WebSocket connection');
      return;
    }

    console.log('Initializing WebSocket connection...');
    
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    
    const newSocket = io(`${apiUrl}/chat`, {
      auth: {
        token: token  // Use auth object instead of extraHeaders for better browser support
      },
      transports: ['websocket', 'polling'], // Try websocket first, fallback to polling
    });

    // Connection events
    newSocket.on('connect', () => {
      console.log('✅ WebSocket connected:', newSocket.id);
      setIsConnected(true);
      
      // Join conversation room if we have one
      if (conversationId) {
        console.log('Joining conversation:', conversationId);
        newSocket.emit('chat:join', { conversationId });
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      if (onError) onError(`Connection error: ${error.message}`);
    });

    // Chat events
    newSocket.on('chat:thinking', (data) => {
      console.log('💭 AI is thinking:', data);
      setIsThinking(true);
      setStreamingContent('');
      setCurrentMessageId(null);
    });

    newSocket.on('chat:streaming', (data) => {
      console.log('📡 Streaming chunk:', data);
      
      if (data.isComplete) {
        console.log('✅ Streaming complete');
        setIsThinking(false);
        setStreamingContent('');
        setCurrentMessageId(null);
      } else {
        setCurrentMessageId(data.messageId);
        setStreamingContent(prev => prev + data.chunk);
      }
    });

    newSocket.on('chat:message', (data) => {
      console.log('💬 New message:', data);
      if (onMessage) onMessage(data.message);
    });

    newSocket.on('chat:complete', (data) => {
      console.log('✅ Chat complete:', data);
      setIsThinking(false);
      setStreamingContent('');
      setCurrentMessageId(null);
    });

    newSocket.on('chat:error', (data) => {
      console.error('❌ Chat error:', data);
      if (onError) onError(data.error);
      setIsThinking(false);
      setStreamingContent('');
      setCurrentMessageId(null);
    });

    newSocket.on('chat:joined', (data) => {
      console.log('✅ Joined conversation:', data);
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    return () => {
      console.log('Cleaning up WebSocket connection');
      newSocket.close();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, conversationId]); // Only re-run when token or conversationId changes

  // Send message function
  const sendMessage = useCallback((content: string) => {
    if (!socket || !conversationId) {
      console.error('Cannot send message: socket or conversationId missing');
      onError?.('Not connected or no conversation selected');
      return;
    }

    console.log('Sending message:', { conversationId, content });
    
    socket.emit('chat:send', {
      conversationId,
      content,
      role: 'user'
    });
  }, [socket, conversationId, onError]);

  // Send typing indicator
  const sendTyping = useCallback((isTyping: boolean) => {
    if (!socket || !conversationId) return;

    socket.emit('chat:typing', {
      conversationId,
      isTyping
    });
  }, [socket, conversationId]);

  // Join conversation
  const joinConversation = useCallback((convId: string) => {
    if (!socket) return;

    console.log('Manually joining conversation:', convId);
    socket.emit('chat:join', { conversationId: convId });
  }, [socket]);

  // Leave conversation
  const leaveConversation = useCallback((convId: string) => {
    if (!socket) return;

    console.log('Leaving conversation:', convId);
    socket.emit('chat:leave', { conversationId: convId });
  }, [socket]);

  return {
    socket,
    isConnected,
    isThinking,
    streamingContent,
    currentMessageId,
    sendMessage,
    sendTyping,
    joinConversation,
    leaveConversation
  };
}

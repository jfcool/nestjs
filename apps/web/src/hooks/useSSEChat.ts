import { useState, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api-client';

interface SSEMessage {
  type: 'user_message' | 'status' | 'assistant_message_chunk' | 'complete' | 'error';
  content?: string;
  message?: string;
  isComplete?: boolean;
  timestamp: string;
  userMessage?: any;
  assistantMessage?: any;
}

interface UseSSEChatOptions {
  onComplete?: (userMessage: any, assistantMessage: any) => void;
  onError?: (error: string) => void;
}

export function useSSEChat({ onComplete, onError }: UseSSEChatOptions = {}) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const eventSourceRef = useRef<EventSource | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const cancelStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
    setStreamingContent('');
    setStatusMessage('');
    sessionIdRef.current = null;
  }, []);

  const sendMessage = useCallback(async (
    conversationId: string,
    content: string,
    useMcp: boolean = true
  ) => {
    // Generate session ID
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    sessionIdRef.current = sessionId;

    // Get token
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
    if (!token) {
      onError?.('Not authenticated');
      return;
    }

    try {
      setIsStreaming(true);
      setStreamingContent('');
      setStatusMessage('Verbinde...');

      // Connect to SSE endpoint
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const eventSource = new EventSource(
        `${apiUrl}/chat/messages/stream/${sessionId}`,
        {
          // Note: EventSource doesn't support custom headers directly
          // The backend must support token in query param or we use a proxy
        }
      );
      eventSourceRef.current = eventSource;

      // Handle messages
      eventSource.onmessage = (event) => {
        try {
          const data: SSEMessage = JSON.parse(event.data);

          switch (data.type) {
            case 'status':
              setStatusMessage(data.message || '');
              break;

            case 'assistant_message_chunk':
              setStreamingContent(data.content || '');
              setStatusMessage('');
              break;

            case 'complete':
              setIsStreaming(false);
              setStreamingContent('');
              setStatusMessage('');
              if (data.userMessage && data.assistantMessage) {
                onComplete?.(data.userMessage, data.assistantMessage);
              }
              eventSource.close();
              break;

            case 'error':
              setIsStreaming(false);
              setStreamingContent('');
              setStatusMessage('');
              onError?.(data.message || 'Unknown error');
              eventSource.close();
              break;
          }
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        setIsStreaming(false);
        setStreamingContent('');
        setStatusMessage('');
        onError?.('Connection error');
        eventSource.close();
      };

      // Send the message to start processing
      await apiClient.post('/chat/messages/stream', {
        conversationId,
        content,
        role: 'user',
        useMcp,
        sessionId,
      });

    } catch (error) {
      console.error('Error sending message:', error);
      setIsStreaming(false);
      setStreamingContent('');
      setStatusMessage('');
      cancelStream();
      onError?.(error instanceof Error ? error.message : 'Failed to send message');
    }
  }, [onComplete, onError, cancelStream]);

  return {
    isStreaming,
    streamingContent,
    statusMessage,
    sendMessage,
    cancelStream,
  };
}

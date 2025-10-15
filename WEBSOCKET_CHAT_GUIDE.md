# WebSocket Chat Implementation Guide

## 🎯 Overview

The chat application now uses **WebSocket** for real-time, bidirectional communication instead of blocking HTTP requests. This provides a better user experience with instant feedback and streaming AI responses.

## 🏗️ Architecture

### Backend (NestJS)

**Components:**
- **ChatGateway** (`apps/api/src/chat/chat.gateway.ts`) - WebSocket event handler
- **WsJwtGuard** (`apps/api/src/auth/guards/ws-jwt.guard.ts`) - WebSocket authentication
- **ChatService** - Existing service for AI processing
- **Socket.IO** - WebSocket library with fallbacks

**Namespace:** `/chat`

**Port:** Same as API (3001)

**URL:** `ws://localhost:3001/chat` or `wss://localhost:3001/chat` (production)

### Events

#### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `chat:send` | `{ conversationId: string, content: string, role: 'user' }` | Send a message |
| `chat:typing` | `{ conversationId: string, isTyping: boolean }` | Typing indicator |
| `chat:join` | `{ conversationId: string }` | Join conversation room |
| `chat:leave` | `{ conversationId: string }` | Leave conversation room |

#### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `chat:thinking` | `{ conversationId: string, status: 'processing' }` | AI is processing |
| `chat:message` | `{ conversationId: string, message: Message }` | Complete message |
| `chat:streaming` | `{ conversationId: string, messageId: string, chunk: string, isComplete: boolean }` | Streaming chunk |
| `chat:complete` | `{ conversationId: string, messageId: string }` | Response complete |
| `chat:error` | `{ conversationId: string, error: string }` | Error occurred |
| `chat:joined` | `{ conversationId: string }` | Successfully joined |
| `chat:user-joined` | `{ userId: string, username: string }` | Another user joined |
| `chat:user-left` | `{ userId: string, username: string }` | User left |
| `chat:user-typing` | `{ userId: string, username: string, isTyping: boolean }` | User typing |

## 🔐 Authentication

WebSocket connections require JWT authentication. The token can be provided in two ways:

### 1. Authorization Header (Recommended)
```typescript
const socket = io('http://localhost:3001/chat', {
  extraHeaders: {
    Authorization: `Bearer ${token}`
  }
});
```

### 2. Query Parameter (Fallback)
```typescript
const socket = io('http://localhost:3001/chat', {
  auth: {
    token: token
  }
});
```

## 📱 Frontend Implementation (Next Steps)

### Install Dependencies

```bash
cd apps/web
pnpm add socket.io-client
```

### Create WebSocket Hook

Create `apps/web/src/hooks/useChatWebSocket.ts`:

```typescript
import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  conversationId: string;
  createdAt: string;
}

export function useChatWebSocket(conversationId: string | null, token: string | null) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    const newSocket = io('http://localhost:3001/chat', {
      extraHeaders: {
        Authorization: `Bearer ${token}`
      }
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      
      if (conversationId) {
        newSocket.emit('chat:join', { conversationId });
      }
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    newSocket.on('chat:thinking', () => {
      setIsThinking(true);
      setStreamingContent('');
    });

    newSocket.on('chat:streaming', (data) => {
      if (data.isComplete) {
        setIsThinking(false);
        setStreamingContent('');
      } else {
        setStreamingContent(prev => prev + data.chunk);
      }
    });

    newSocket.on('chat:message', (data) => {
      setMessages(prev => [...prev, data.message]);
    });

    newSocket.on('chat:complete', () => {
      setIsThinking(false);
      setStreamingContent('');
    });

    newSocket.on('chat:error', (data) => {
      console.error('Chat error:', data.error);
      setIsThinking(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [token, conversationId]);

  const sendMessage = (content: string) => {
    if (!socket || !conversationId) return;

    socket.emit('chat:send', {
      conversationId,
      content,
      role: 'user'
    });
  };

  const sendTyping = (isTyping: boolean) => {
    if (!socket || !conversationId) return;

    socket.emit('chat:typing', {
      conversationId,
      isTyping
    });
  };

  return {
    socket,
    messages,
    isThinking,
    streamingContent,
    isConnected,
    sendMessage,
    sendTyping
  };
}
```

### Update Chat Component

```typescript
'use client';

import { useChatWebSocket } from '@/hooks/useChatWebSocket';
import { useAuth } from '@/contexts/AuthContext';

export function ChatInterface({ conversationId }: { conversationId: string }) {
  const { token } = useAuth();
  const {
    messages,
    isThinking,
    streamingContent,
    isConnected,
    sendMessage,
    sendTyping
  } = useChatWebSocket(conversationId, token);

  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    sendTyping(value.length > 0);
  };

  return (
    <div>
      <div className="connection-status">
        {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>

      <div className="messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}

        {isThinking && (
          <div className="message assistant streaming">
            {streamingContent || '💭 Thinking...'}
          </div>
        )}
      </div>

      <div className="input">
        <input
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}
```

## 🚀 Current Implementation Status

### ✅ Phase 1: Backend Infrastructure (COMPLETE)

- [x] WebSocket dependencies installed
- [x] Chat Gateway created with event handlers
- [x] JWT authentication guard for WebSockets
- [x] Module configuration
- [x] Simulated streaming (chunks AI response)

### 🔄 Phase 2: Next Steps

- [ ] **True AI Streaming**: Implement real token-by-token streaming from Claude API
- [ ] **Frontend WebSocket Client**: Create React hook and components
- [ ] **UI Components**: Build streaming message display
- [ ] **Error Handling**: Reconnection logic, error states
- [ ] **Typing Indicators**: Visual feedback for typing users
- [ ] **Message Persistence**: Ensure messages are saved correctly

### 🎯 Phase 3: Advanced Features (Future)

- [ ] **Redis Adapter**: For horizontal scaling across multiple servers
- [ ] **Presence System**: Show online users
- [ ] **Message Reactions**: Emoji reactions to messages
- [ ] **File Sharing**: Send images/files through WebSocket
- [ ] **Voice Messages**: Audio message support

## 🔧 Configuration

### Environment Variables

```env
# .env
FRONTEND_URL=http://localhost:3000
JWT_SECRET=your-secret-key
```

### CORS Configuration

The WebSocket gateway allows connections from the frontend URL specified in `FRONTEND_URL` environment variable.

## 🧪 Testing

### Using Postman or Socket.IO Client

1. Install Socket.IO client tester
2. Connect to `ws://localhost:3001/chat`
3. Add authentication token
4. Join a conversation: `emit('chat:join', { conversationId: 'xxx' })`
5. Send a message: `emit('chat:send', { conversationId: 'xxx', content: 'Hello', role: 'user' })`
6. Listen for events: `on('chat:streaming', callback)`

### Browser Console Testing

```javascript
// Connect with authentication
const token = 'your-jwt-token';
const socket = io('http://localhost:3001/chat', {
  extraHeaders: {
    Authorization: `Bearer ${token}`
  }
});

// Listen for connection
socket.on('connect', () => {
  console.log('Connected!', socket.id);
});

// Join conversation
socket.emit('chat:join', { conversationId: 'your-conversation-id' });

// Send message
socket.emit('chat:send', {
  conversationId: 'your-conversation-id',
  content: 'Hello from WebSocket!',
  role: 'user'
});

// Listen for streaming
socket.on('chat:streaming', (data) => {
  console.log('Streaming:', data);
});

// Listen for complete message
socket.on('chat:message', (data) => {
  console.log('Message:', data);
});
```

## 📚 Resources

- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [NestJS WebSockets](https://docs.nestjs.com/websockets/gateways)
- [JWT Authentication with WebSockets](https://socket.io/docs/v4/middlewares/#sending-credentials)

## 🐛 Troubleshooting

### Connection Issues

**Problem:** Cannot connect to WebSocket
**Solution:** Check CORS configuration, ensure JWT token is valid

**Problem:** Authentication fails
**Solution:** Verify token is being sent in Authorization header or auth object

### Performance

**Problem:** Slow streaming
**Solution:** Adjust chunk size in `splitIntoChunks()` method

**Problem:** Connection drops
**Solution:** Implement reconnection logic in frontend, check server logs

## 🔐 Security Considerations

1. **Always use WSS** (WebSocket Secure) in production
2. **Validate JWT tokens** on every message
3. **Rate limiting** for message sending
4. **Input validation** for all incoming data
5. **Room isolation** - users can only access their conversations
6. **CORS configuration** - restrict to trusted origins

## 📖 Future Enhancements

1. **Optimistic UI Updates** - Show messages immediately, sync later
2. **Message Queue** - Handle offline message delivery
3. **Load Balancing** - Redis Pub/Sub for multi-server setup
4. **Compression** - Enable WebSocket compression for large messages
5. **Binary Data** - Support for file uploads via WebSocket
6. **Connection Pooling** - Efficient socket management
7. **Metrics & Monitoring** - Track connection count, message rates

---

**Status:** ✅ Backend infrastructure complete and running
**Next:** Frontend WebSocket client implementation

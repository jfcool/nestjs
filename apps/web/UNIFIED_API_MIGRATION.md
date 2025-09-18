# Unified API Client Migration Guide

This document outlines the migration from hardcoded API calls to the unified API client system.

## Overview

The unified API client provides:
- ✅ **Centralized Configuration**: Single source of truth for API endpoints
- ✅ **Automatic Retries**: Built-in retry logic with exponential backoff
- ✅ **Error Handling**: Consistent error types and messages
- ✅ **Timeout Management**: Configurable request timeouts
- ✅ **Logging**: Comprehensive request/response logging
- ✅ **Environment Detection**: Automatic API URL detection

## Files Created

### 1. `/src/lib/api-config.ts`
Central configuration file containing:
- API base URL detection (localhost:3000 for development)
- All endpoint definitions organized by module
- Request configuration (timeouts, retries, etc.)

### 2. `/src/lib/api-client.ts`
Unified API client with:
- Custom error types (`ApiError`, `NetworkError`)
- Retry logic with configurable attempts
- Timeout handling
- Consistent response format
- Convenience methods for all API operations

## Migration Pattern

### Before (Old Pattern):
```typescript
const fetchData = async () => {
  try {
    const response = await fetch('http://localhost:3002/api/endpoint');
    if (response.ok) {
      const data = await response.json();
      setData(data);
    }
  } catch (error) {
    console.error('Error:', error);
    // Basic error handling
  }
};
```

### After (New Pattern):
```typescript
import { api, ApiError, NetworkError } from '@/lib/api-client';

const fetchData = async () => {
  try {
    const response = await api.module.operation();
    setData(response.data);
  } catch (error) {
    const errorMessage = error instanceof ApiError 
      ? `API Error: ${error.message}` 
      : error instanceof NetworkError 
      ? `Network Error: ${error.message}`
      : 'Operation failed';
    
    toast({
      title: 'Error',
      description: errorMessage,
      variant: 'destructive',
    });
  }
};
```

## API Client Usage Examples

### Chat Operations
```typescript
// Conversations
await api.chat.conversations.list();
await api.chat.conversations.create(conversationData);
await api.chat.conversations.update(id, updateData);
await api.chat.conversations.delete(id);

// Messages
await api.chat.messages.send(messageData);

// MCP
await api.chat.mcp.servers();
await api.chat.mcp.reload();

// Models
await api.chat.models.all();
await api.chat.models.default();
await api.chat.models.setDefault(modelData);
```

### Users Operations
```typescript
await api.users.list();
await api.users.create(userData);
await api.users.update(id, userData);
await api.users.delete(id);
```

### SAP OData Operations
```typescript
// Connections
await api.sapOData.connections.list();
await api.sapOData.connections.create(connectionData);
await api.sapOData.connections.update(id, connectionData);
await api.sapOData.connections.delete(id);
await api.sapOData.connections.test(id, testData);

// Data Operations
await api.sapOData.connections.catalog(id, catalogData);
await api.sapOData.connections.metadata(id, metadataData);
await api.sapOData.connections.data(id, dataRequest);

// Services
await api.sapOData.services.metadataParsed(connectionId, serviceName, requestData);
await api.sapOData.services.entitySetData(connectionId, serviceName, entitySetName, requestData);

// Cloud SDK
await api.sapOData.cloudSdk.health();
await api.sapOData.cloudSdk.execute(requestData);
```

## Migration Status

### ✅ Completed
- [x] Created unified API configuration
- [x] Created unified API client with error handling
- [x] Migrated Chat page `fetchConversations` function

### 🔄 In Progress
- [ ] Complete Chat page migration (remaining functions)
- [ ] Migrate Users page
- [ ] Migrate SAP OData pages
- [ ] Migrate SAP OData components

### 📋 Remaining Functions to Migrate

#### Chat Page (`/src/app/chat/page.tsx`)
- [ ] `fetchMcpServers` → `api.chat.mcp.servers()`
- [ ] `reloadMcpConfiguration` → `api.chat.mcp.reload()`
- [ ] `fetchAiModels` → `api.chat.models.all()`
- [ ] `fetchDefaultModel` → `api.chat.models.default()`
- [ ] `setDefaultModelApi` → `api.chat.models.setDefault()`
- [ ] `createNewConversation` → `api.chat.conversations.create()`
- [ ] `sendMessage` → `api.chat.messages.send()`
- [ ] `deleteConversation` → `api.chat.conversations.delete()`
- [ ] `saveRename` → `api.chat.conversations.update()`

#### Users Page (`/src/app/users/page.tsx`)
- [ ] Replace `useGetUsers` with `api.users.list()`
- [ ] Replace `useDeleteUserCustom` with `api.users.delete()`

#### SAP OData Pages
- [ ] `/src/app/sapodata/page.tsx` - All fetch calls
- [ ] `/src/app/sapodata/connections/page.tsx` - All fetch calls
- [ ] `/src/app/sapodata/components/EntitySetsViewer.tsx` - All fetch calls
- [ ] `/src/app/sapodata/components/SapCloudSdkViewer.tsx` - All fetch calls

## Benefits After Migration

1. **Consistent Error Handling**: All API calls will have the same error handling pattern
2. **Automatic Retries**: Network issues will be automatically retried
3. **Better Logging**: All API calls will be logged with consistent format
4. **Environment Flexibility**: Easy to switch between development/production APIs
5. **Type Safety**: Better TypeScript support with defined response types
6. **Maintainability**: Single place to update API endpoints and configuration

## Configuration

The API client automatically detects the environment:
- **Development**: `http://localhost:3000` (corrected from 3002)
- **Production**: Uses `NEXT_PUBLIC_API_URL` environment variable

## Error Types

- **ApiError**: HTTP errors (4xx, 5xx responses)
- **NetworkError**: Network connectivity issues, timeouts
- **Standard Error**: Unexpected errors

## Next Steps

1. Complete migration of remaining functions in Chat page
2. Migrate Users page to use unified API client
3. Migrate all SAP OData pages and components
4. Test all functionality with the new API client
5. Remove old hardcoded fetch calls
6. Update environment variables if needed

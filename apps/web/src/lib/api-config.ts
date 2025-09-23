/**
 * Central API Configuration
 * This file contains all API endpoints and configuration for the frontend
 */

// Environment-based configuration
const getApiBaseUrl = (): string => {
  // Check if we're in development, staging, or production
  if (typeof window !== 'undefined') {
    // Client-side
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // Development environment
      return `${protocol}//localhost:3001`;
    }
  }
  
  // Server-side or production fallback
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
};

export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
} as const;

// API Endpoints organized by module
export const API_ENDPOINTS = {
  // Auth API
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    PROFILE: '/auth/profile',
    ME: '/auth/me',
  },
  
  // Permissions API
  PERMISSIONS: {
    AVAILABLE: '/permissions/available',
    ROLES: '/permissions/roles',
    ROLE_BY_ID: (id: string) => `/permissions/roles/${id}`,
    USERS: '/permissions/users',
    USER_ROLES: (userId: string) => `/permissions/users/${userId}/roles`,
    USER_ROLE_DELETE: (userId: string, roleId: string) => `/permissions/users/${userId}/roles/${roleId}`,
  },
  
  // Users API
  USERS: {
    LIST: '/users',
    CREATE: '/users',
    UPDATE: (id: string) => `/users/${id}`,
    DELETE: (id: string) => `/users/${id}`,
  },
  
  // Chat API
  CHAT: {
    CONVERSATIONS: '/chat/conversations',
    MESSAGES: '/chat/messages',
    CONVERSATION_BY_ID: (id: string) => `/chat/conversations/${id}`,
    MCP_SERVERS: '/chat/mcp/servers',
    MCP_RELOAD: '/chat/mcp/reload',
    MODELS_ALL: '/chat/models/all',
    MODELS_DEFAULT: '/chat/models/default',
  },
  
  // SAP OData API
  SAP_ODATA: {
    CONNECTIONS: '/sapodata/connections',
    CONNECTION_BY_ID: (id: string) => `/sapodata/connections/${id}`,
    CONNECTION_TEST: (id: string) => `/sapodata/connections/${id}/test`,
    CONNECTION_CATALOG: (id: string) => `/sapodata/connection/${id}/catalog`,
    CONNECTION_METADATA: (id: string) => `/sapodata/connection/${id}/metadata`,
    CONNECTION_DATA: (id: string) => `/sapodata/connection/${id}/data`,
    SERVICE_METADATA_PARSED: (connectionId: string, serviceName: string) => 
      `/sapodata/connection/${connectionId}/service/${serviceName}/metadata/parsed`,
    ENTITY_SET_DATA: (connectionId: string, serviceName: string, entitySetName: string) => 
      `/sapodata/connection/${connectionId}/service/${serviceName}/entityset/${entitySetName}`,
    CLOUD_SDK_HEALTH: '/sapodata/cloud-sdk/health',
    CLOUD_SDK_EXECUTE: '/sapodata/cloud-sdk/execute',
  },
  
  // Documents API
  DOCUMENTS: {
    LIST: '/documents',
    STATS: '/documents/stats',
    SEARCH: '/documents/search',
    CONTEXT: '/documents/context',
    INDEX: '/documents/index',
    EMBEDDING_TEST: '/documents/embedding/test',
    BY_ID: (id: string) => `/documents/${id}`,
    CHUNKS: (id: string) => `/documents/${id}/chunks`,
    SEARCH_WITHIN: (id: string) => `/documents/${id}/search`,
  },
} as const;

export type ApiEndpoint = string;
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface ApiRequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
}

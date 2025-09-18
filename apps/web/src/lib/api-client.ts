/**
 * Unified API Client
 * This is the central connectivity layer that all components should use
 * for backend communication. It provides consistent error handling,
 * retries, timeouts, and logging.
 */

import { API_CONFIG, API_ENDPOINTS, ApiRequestOptions, HttpMethod } from './api-config';

// Custom error types
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public endpoint?: string,
    public method?: HttpMethod
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NetworkError extends Error {
  constructor(message: string, public endpoint?: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

// Response wrapper type
export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
}

// Utility function to wait/delay
const delay = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

// Main API Client class
class ApiClient {
  private baseUrl: string;
  private defaultTimeout: number;
  private defaultRetries: number;
  private retryDelay: number;

  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL;
    this.defaultTimeout = API_CONFIG.TIMEOUT;
    this.defaultRetries = API_CONFIG.RETRY_ATTEMPTS;
    this.retryDelay = API_CONFIG.RETRY_DELAY;
  }

  /**
   * Main request method with retry logic and error handling
   */
  private async makeRequest<T = any>(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = this.defaultTimeout,
      retries = this.defaultRetries,
    } = options;

    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    
    // Set up timeout
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Prepare request options
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      signal: controller.signal,
    };

    // Add body for non-GET requests
    if (body && method !== 'GET') {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    let lastError: Error | null = null;

    // Retry logic
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        console.log(`[API] ${method} ${endpoint} (attempt ${attempt + 1}/${retries + 1})`);
        
        const response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);

        // Handle HTTP errors
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new ApiError(
            `HTTP ${response.status}: ${errorText}`,
            response.status,
            endpoint,
            method
          );
        }

        // Parse response
        let data: T;
        const contentType = response.headers.get('content-type');
        
        if (contentType?.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text() as unknown as T;
        }

        console.log(`[API] ✅ ${method} ${endpoint} - Success`);
        
        return {
          data,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        };

      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error as Error;

        // Don't retry on certain errors
        if (error instanceof ApiError && error.status && error.status < 500) {
          // Client errors (4xx) shouldn't be retried
          break;
        }

        if (error instanceof Error && error.name === 'AbortError') {
          throw new NetworkError(`Request timeout after ${timeout}ms`, endpoint);
        }

        // Log retry attempt
        if (attempt < retries) {
          console.warn(`[API] ⚠️ ${method} ${endpoint} failed (attempt ${attempt + 1}), retrying in ${this.retryDelay}ms...`);
          await delay(this.retryDelay);
        }
      }
    }

    // All retries failed
    console.error(`[API] ❌ ${method} ${endpoint} - All retries failed`);
    
    if (lastError instanceof ApiError || lastError instanceof NetworkError) {
      throw lastError;
    }
    
    throw new NetworkError(
      `Network request failed: ${lastError?.message || 'Unknown error'}`,
      endpoint
    );
  }

  /**
   * GET request
   */
  async get<T = any>(endpoint: string, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T = any>(endpoint: string, body?: any, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...options, method: 'POST', body });
  }

  /**
   * PUT request
   */
  async put<T = any>(endpoint: string, body?: any, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...options, method: 'PUT', body });
  }

  /**
   * DELETE request
   */
  async delete<T = any>(endpoint: string, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * PATCH request
   */
  async patch<T = any>(endpoint: string, body?: any, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...options, method: 'PATCH', body });
  }

  /**
   * Update base URL (useful for environment changes)
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
    console.log(`[API] Base URL updated to: ${url}`);
  }

  /**
   * Get current base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// Convenience functions for common operations
export const api = {
  // Users
  users: {
    list: () => apiClient.get(API_ENDPOINTS.USERS.LIST),
    create: (userData: any) => apiClient.post(API_ENDPOINTS.USERS.CREATE, userData),
    update: (id: string, userData: any) => apiClient.put(API_ENDPOINTS.USERS.UPDATE(id), userData),
    delete: (id: string) => apiClient.delete(API_ENDPOINTS.USERS.DELETE(id)),
  },

  // Chat
  chat: {
    conversations: {
      list: () => apiClient.get(API_ENDPOINTS.CHAT.CONVERSATIONS),
      create: (conversationData: any) => apiClient.post(API_ENDPOINTS.CHAT.CONVERSATIONS, conversationData),
      update: (id: string, conversationData: any) => apiClient.put(API_ENDPOINTS.CHAT.CONVERSATION_BY_ID(id), conversationData),
      delete: (id: string) => apiClient.delete(API_ENDPOINTS.CHAT.CONVERSATION_BY_ID(id)),
    },
    messages: {
      send: (messageData: any) => apiClient.post(API_ENDPOINTS.CHAT.MESSAGES, messageData),
    },
    mcp: {
      servers: () => apiClient.get(API_ENDPOINTS.CHAT.MCP_SERVERS),
      reload: () => apiClient.post(API_ENDPOINTS.CHAT.MCP_RELOAD),
    },
    models: {
      all: () => apiClient.get(API_ENDPOINTS.CHAT.MODELS_ALL),
      default: () => apiClient.get(API_ENDPOINTS.CHAT.MODELS_DEFAULT),
      setDefault: (modelData: any) => apiClient.post(API_ENDPOINTS.CHAT.MODELS_DEFAULT, modelData),
    },
  },

  // SAP OData
  sapOData: {
    connections: {
      list: () => apiClient.get(API_ENDPOINTS.SAP_ODATA.CONNECTIONS),
      create: (connectionData: any) => apiClient.post(API_ENDPOINTS.SAP_ODATA.CONNECTIONS, connectionData),
      update: (id: string, connectionData: any) => apiClient.put(API_ENDPOINTS.SAP_ODATA.CONNECTION_BY_ID(id), connectionData),
      delete: (id: string) => apiClient.delete(API_ENDPOINTS.SAP_ODATA.CONNECTION_BY_ID(id)),
      test: (id: string, testData: any) => apiClient.post(API_ENDPOINTS.SAP_ODATA.CONNECTION_TEST(id), testData),
      catalog: (id: string, catalogData: any) => apiClient.post(API_ENDPOINTS.SAP_ODATA.CONNECTION_CATALOG(id), catalogData),
      metadata: (id: string, metadataData: any) => apiClient.post(API_ENDPOINTS.SAP_ODATA.CONNECTION_METADATA(id), metadataData),
      data: (id: string, dataRequest: any) => apiClient.post(API_ENDPOINTS.SAP_ODATA.CONNECTION_DATA(id), dataRequest),
    },
    services: {
      metadataParsed: (connectionId: string, serviceName: string, requestData: any) => 
        apiClient.post(API_ENDPOINTS.SAP_ODATA.SERVICE_METADATA_PARSED(connectionId, serviceName), requestData),
      entitySetData: (connectionId: string, serviceName: string, entitySetName: string, requestData: any) => 
        apiClient.post(API_ENDPOINTS.SAP_ODATA.ENTITY_SET_DATA(connectionId, serviceName, entitySetName), requestData),
    },
    cloudSdk: {
      health: () => apiClient.get(API_ENDPOINTS.SAP_ODATA.CLOUD_SDK_HEALTH),
      execute: (requestData: any) => apiClient.post(API_ENDPOINTS.SAP_ODATA.CLOUD_SDK_EXECUTE, requestData),
    },
  },
};

// Export everything
export { apiClient as default, API_ENDPOINTS, API_CONFIG };

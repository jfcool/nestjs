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
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<boolean> | null = null;

  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL;
    this.defaultTimeout = API_CONFIG.TIMEOUT;
    this.defaultRetries = API_CONFIG.RETRY_ATTEMPTS;
    this.retryDelay = API_CONFIG.RETRY_DELAY;
  }

  /**
   * Check if token is expired by decoding JWT
   */
  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp < currentTime;
    } catch {
      return true; // If we can't decode, assume expired
    }
  }

  /**
   * Attempt to refresh the session by re-authenticating
   */
  private async refreshSession(): Promise<boolean> {
    if (this.isRefreshing) {
      return this.refreshPromise || Promise.resolve(false);
    }

    this.isRefreshing = true;
    this.refreshPromise = this.performRefresh();
    
    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Perform the actual refresh logic
   */
  private async performRefresh(): Promise<boolean> {
    try {
      // Check if we have user credentials to re-authenticate
      const userData = sessionStorage.getItem('user');
      if (!userData) {
        this.clearSession();
        return false;
      }

      // For now, we'll clear the session and redirect to login
      // In a more advanced implementation, you could implement refresh tokens
      console.log('[API] Session expired, redirecting to login...');
      this.clearSession();
      
      // Redirect to login page
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      
      return false;
    } catch (error) {
      console.error('[API] Session refresh failed:', error);
      this.clearSession();
      return false;
    }
  }

  /**
   * Clear session data
   */
  private clearSession(): void {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
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

    // Get token from sessionStorage and add to headers
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
    
    // Build headers object
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };
    
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }

    // Prepare request options
    const fetchOptions: RequestInit = {
      method,
      headers: requestHeaders,
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
          // Handle 401 Unauthorized - attempt session refresh
          if (response.status === 401 && token && !endpoint.includes('/auth/login')) {
            console.log('[API] 401 Unauthorized - checking token expiration...');
            
            if (this.isTokenExpired(token)) {
              console.log('[API] Token expired, attempting session refresh...');
              const refreshed = await this.refreshSession();
              
              if (refreshed) {
                // Retry the request with new token
                console.log('[API] Session refreshed, retrying request...');
                continue; // This will retry the current attempt
              }
            }
          }
          
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
    console.warn(`[API] ❌ ${method} ${endpoint} - All retries failed`);
    
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
      list: () => apiClient.get('/chat/conversations'),
      create: (conversationData: any) => apiClient.post('/chat/conversations', conversationData),
      update: (id: string, conversationData: any) => apiClient.put(`/chat/conversations/${id}`, conversationData),
      delete: (id: string) => apiClient.delete(`/chat/conversations/${id}`),
    },
    messages: {
      send: (messageData: any) => apiClient.post('/chat/messages', messageData),
    },
    mcp: {
      servers: () => apiClient.get('/chat/mcp/servers'),
      reload: () => apiClient.post('/chat/mcp/reload'),
    },
    models: {
      all: () => apiClient.get('/chat/models/all'),
      default: () => apiClient.get('/chat/models/default'),
      setDefault: (modelData: any) => apiClient.post('/chat/models/default', modelData),
    },
  },

  // Permissions
  permissions: {
    available: () => apiClient.get(API_ENDPOINTS.PERMISSIONS.AVAILABLE),
    roles: {
      list: () => apiClient.get(API_ENDPOINTS.PERMISSIONS.ROLES),
      create: (roleData: any) => apiClient.post(API_ENDPOINTS.PERMISSIONS.ROLES, roleData),
      update: (id: string, roleData: any) => apiClient.put(API_ENDPOINTS.PERMISSIONS.ROLE_BY_ID(id), roleData),
      delete: (id: string) => apiClient.delete(API_ENDPOINTS.PERMISSIONS.ROLE_BY_ID(id)),
    },
    users: {
      list: () => apiClient.get(API_ENDPOINTS.PERMISSIONS.USERS),
      assignRoles: (userId: string, roleData: any) => apiClient.post(API_ENDPOINTS.PERMISSIONS.USER_ROLES(userId), roleData),
      removeRole: (userId: string, roleId: string) => apiClient.delete(API_ENDPOINTS.PERMISSIONS.USER_ROLE_DELETE(userId, roleId)),
    },
  },

  // Auth
  auth: {
    login: (credentials: any) => apiClient.post('/auth/login', credentials),
    changePassword: (passwordData: any) => apiClient.post('/auth/change-password', passwordData),
    me: () => apiClient.get('/auth/me'),
  },

  // Dashboard
  dashboard: {
    stats: () => apiClient.get('/dashboard/stats'),
  },

  // SAP OData
  sapOData: {
    connections: {
      list: () => apiClient.get('/sapodata/connections'),
      create: (connectionData: any) => apiClient.post('/sapodata/connections', connectionData),
      update: (id: string, connectionData: any) => apiClient.put(`/sapodata/connections/${id}`, connectionData),
      delete: (id: string) => apiClient.delete(`/sapodata/connections/${id}`),
      test: (id: string, testData: any) => apiClient.post(`/sapodata/connections/${id}/test`, testData),
      catalog: (id: string, catalogData: any) => apiClient.post(`/sapodata/connection/${id}/catalog`, catalogData),
      metadata: (id: string, metadataData: any) => apiClient.post(`/sapodata/connection/${id}/metadata`, metadataData),
      data: (id: string, dataRequest: any) => apiClient.post(`/sapodata/connection/${id}/data`, dataRequest),
    },
    services: {
      metadataParsed: (connectionId: string, serviceName: string, requestData: any) => 
        apiClient.post(`/sapodata/connection/${connectionId}/service/${serviceName}/metadata/parsed`, requestData),
      entitySetData: (connectionId: string, serviceName: string, entitySetName: string, requestData: any) => 
        apiClient.post(`/sapodata/connection/${connectionId}/service/${serviceName}/entityset/${entitySetName}`, requestData),
    },
    cloudSdk: {
      health: () => apiClient.get('/sapodata/cloud-sdk/health'),
      execute: (requestData: any) => apiClient.post('/sapodata/cloud-sdk/execute', requestData),
      businessPartners: (requestData: any) => apiClient.post('/sapodata/cloud-sdk/business-partners', requestData),
    },
  },
};

// Export everything
export { apiClient as default, API_ENDPOINTS, API_CONFIG };

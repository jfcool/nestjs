/**
 * Unified API Client
 * This is the central connectivity layer that all components should use
 * for backend communication. It provides consistent error handling,
 * retries, timeouts, and logging.
 */

// Custom error types
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public endpoint?: string,
    public method?: string
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

// Environment-based configuration
const getApiBaseUrl = (): string => {
  // Check if we're in development, staging, or production
  if (typeof window !== 'undefined') {
    // Client-side - always use the same hostname as the frontend, just change the port
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    // Handle file:// protocol (fallback to localhost)
    if (protocol === 'file:' || !hostname) {
      return `http://localhost:3001`;
    }
    
    // For all other cases (localhost, IP, hostname), use the same host with port 3001
    // Force HTTP protocol for development (even if frontend uses HTTPS)
    return `http://${hostname}:3001`;
  }
  
  // Server-side or production fallback
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
};

// Configuration
const API_CONFIG = {
  get BASE_URL() {
    return getApiBaseUrl();
  },
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
};

// Utility function to wait/delay
const delay = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

// Main API Client class
class ApiClient {
  private defaultTimeout: number;
  private defaultRetries: number;
  private retryDelay: number;
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<boolean> | null = null;

  constructor() {
    // Don't cache BASE_URL - get it dynamically each time
    this.defaultTimeout = API_CONFIG.TIMEOUT;
    this.defaultRetries = API_CONFIG.RETRY_ATTEMPTS;
    this.retryDelay = API_CONFIG.RETRY_DELAY;
  }

  /**
   * Get the current base URL dynamically
   */
  private getBaseUrl(): string {
    return API_CONFIG.BASE_URL;
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
      const userData = typeof window !== 'undefined' ? sessionStorage.getItem('user') : null;
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
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: any;
      timeout?: number;
      retries?: number;
    } = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = this.defaultTimeout,
      retries = this.defaultRetries,
    } = options;

    const url = `${this.getBaseUrl()}${endpoint}`;
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
  async get<T = any>(endpoint: string, options: Omit<Parameters<typeof this.makeRequest>[1], 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T = any>(endpoint: string, body?: any, options: Omit<Parameters<typeof this.makeRequest>[1], 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...options, method: 'POST', body });
  }

  /**
   * PUT request
   */
  async put<T = any>(endpoint: string, body?: any, options: Omit<Parameters<typeof this.makeRequest>[1], 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...options, method: 'PUT', body });
  }

  /**
   * DELETE request
   */
  async delete<T = any>(endpoint: string, options: Omit<Parameters<typeof this.makeRequest>[1], 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * PATCH request
   */
  async patch<T = any>(endpoint: string, body?: any, options: Omit<Parameters<typeof this.makeRequest>[1], 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...options, method: 'PATCH', body });
  }

}

// Create singleton instance
export const apiClient = new ApiClient();

// Export everything
export { apiClient as default };

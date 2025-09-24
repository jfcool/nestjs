'use client';

import { API_CONFIG, API_ENDPOINTS } from './api-config';

// Temporary API client for documents until orval generation is fixed
// This follows the project pattern and can be easily replaced with generated hooks

export interface Document {
  id: string;
  title: string;
  path: string;
  fileType: string;
  fileSize: number;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult {
  documentId: string;
  chunkId: string;
  documentPath: string;
  documentTitle: string;
  content: string;
  score: number;
  chunkIndex: number;
}

export interface DocumentStats {
  totalDocuments: number;
  totalChunks: number;
  averageChunkSize: number;
  documentsWithEmbeddings: number;
  totalSize: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

class DocumentsApiClient {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    try {
      // Get auth token from sessionStorage (matches AuthContext)
      const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Add additional headers if provided
      if (options?.headers) {
        Object.assign(headers, options.headers);
      }
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
        headers,
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
        console.error('API request failed:', {
          endpoint,
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        
        // Return detailed error information
        return {
          success: false,
          data: null as any,
          error: errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  }

  async getDocuments(limit: number = 50, offset: number = 0): Promise<ApiResponse<Document[]>> {
    return this.request<Document[]>(`${API_ENDPOINTS.DOCUMENTS.LIST}?limit=${limit}&offset=${offset}`);
  }

  async getStats(): Promise<ApiResponse<DocumentStats>> {
    return this.request<DocumentStats>(API_ENDPOINTS.DOCUMENTS.STATS);
  }

  async searchDocuments(query: string, limit: number = 10, threshold?: number): Promise<ApiResponse<SearchResult[]>> {
    let url = `${API_ENDPOINTS.DOCUMENTS.SEARCH}?query=${encodeURIComponent(query)}&limit=${limit}`;
    if (threshold !== undefined) {
      url += `&threshold=${threshold}`;
    }
    return this.request<SearchResult[]>(url);
  }

  async indexPath(path: string): Promise<ApiResponse<any>> {
    return this.request<any>(API_ENDPOINTS.DOCUMENTS.INDEX, {
      method: 'POST',
      body: JSON.stringify({ path }),
    });
  }

  async testEmbeddingService(): Promise<ApiResponse<{ connected: boolean; dimensions: number }>> {
    return this.request<{ connected: boolean; dimensions: number }>(API_ENDPOINTS.DOCUMENTS.EMBEDDING_TEST);
  }

  async clearAllDocuments(): Promise<ApiResponse<any>> {
    return this.request<any>('/documents/clear-all', {
      method: 'DELETE',
    });
  }
}

export const documentsApi = new DocumentsApiClient();

// React hooks that mimic the generated API hooks pattern
import { useState, useEffect } from 'react';

export function useGetDocuments(limit: number = 50, offset: number = 0) {
  const [data, setData] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = async () => {
    try {
      setIsLoading(true);
      setIsError(false);
      const response = await documentsApi.getDocuments(limit, offset);
      if (response.success) {
        setData(response.data);
      } else {
        throw new Error(response.error || 'Failed to fetch documents');
      }
    } catch (err) {
      setIsError(true);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refetch();
  }, [limit, offset]);

  return { data, isLoading, isError, error, refetch };
}

export function useGetDocumentStats() {
  const [data, setData] = useState<DocumentStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = async () => {
    try {
      setIsLoading(true);
      setIsError(false);
      const response = await documentsApi.getStats();
      if (response.success) {
        setData(response.data);
      } else {
        throw new Error(response.error || 'Failed to fetch stats');
      }
    } catch (err) {
      setIsError(true);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refetch();
  }, []);

  return { data, isLoading, isError, error, refetch };
}

export function useSearchDocuments() {
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = async (params: { query: string; limit?: number; threshold?: number } | string, limit: number = 10): Promise<SearchResult[]> => {
    try {
      setIsLoading(true);
      setIsError(false);
      
      let query: string;
      let searchLimit: number;
      let threshold: number | undefined;
      
      if (typeof params === 'string') {
        // Backward compatibility: if first param is string, use old signature
        query = params;
        searchLimit = limit;
        threshold = undefined;
      } else {
        // New signature: object with query, limit, and threshold
        query = params.query;
        searchLimit = params.limit || 10;
        threshold = params.threshold;
      }
      
      const response = await documentsApi.searchDocuments(query, searchLimit, threshold);
      if (response.success) {
        return response.data;
      } else {
        throw new Error(response.error || 'Search failed');
      }
    } catch (err) {
      setIsError(true);
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { mutate, isLoading, isError, error };
}

export function useIndexPath() {
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = async (path: string): Promise<any> => {
    try {
      setIsLoading(true);
      setIsError(false);
      const response = await documentsApi.indexPath(path);
      if (response.success) {
        return response.data;
      } else {
        throw new Error(response.error || 'Indexing failed');
      }
    } catch (err) {
      setIsError(true);
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { mutate, isLoading, isError, error };
}

export function useTestEmbeddingService() {
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = async (): Promise<{ connected: boolean; dimensions: number }> => {
    try {
      setIsLoading(true);
      setIsError(false);
      const response = await documentsApi.testEmbeddingService();
      if (response.success) {
        return response.data;
      } else {
        throw new Error(response.error || 'Test failed');
      }
    } catch (err) {
      setIsError(true);
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { mutate, isLoading, isError, error };
}

export function useClearAllDocuments() {
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = async (): Promise<any> => {
    try {
      setIsLoading(true);
      setIsError(false);
      const response = await documentsApi.clearAllDocuments();
      if (response.success) {
        return response.data;
      } else {
        throw new Error(response.error || 'Clear failed');
      }
    } catch (err) {
      setIsError(true);
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { mutate, isLoading, isError, error };
}

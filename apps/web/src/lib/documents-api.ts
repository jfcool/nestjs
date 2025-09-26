'use client';

import { apiClient } from '@/lib/api-client';

// API endpoints
const API_ENDPOINTS = {
  DOCUMENTS: {
    LIST: '/documents',
    STATS: '/documents/stats',
    SEARCH: '/documents/search',
    INDEX: '/documents/index',
    EMBEDDING_TEST: '/documents/embedding/test',
  },
};

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
  async getDocuments(limit: number = 50, offset: number = 0): Promise<ApiResponse<Document[]>> {
    try {
      const response = await apiClient.get(`${API_ENDPOINTS.DOCUMENTS.LIST}?limit=${limit}&offset=${offset}`);
      // API returns { success: true, data: [...], pagination: {...} }
      return { success: true, data: response.data.data || response.data };
    } catch (error: any) {
      return { success: false, data: [], error: error.message || 'Failed to fetch documents' };
    }
  }

  async getStats(): Promise<ApiResponse<DocumentStats>> {
    try {
      const response = await apiClient.get(API_ENDPOINTS.DOCUMENTS.STATS);
      // API returns { success: true, data: {...} }
      return { success: true, data: response.data.data || response.data };
    } catch (error: any) {
      return { success: false, data: null as any, error: error.message || 'Failed to fetch stats' };
    }
  }

  async searchDocuments(query: string, limit: number = 10, threshold?: number): Promise<ApiResponse<SearchResult[]>> {
    try {
      let url = `${API_ENDPOINTS.DOCUMENTS.SEARCH}?query=${encodeURIComponent(query)}&limit=${limit}`;
      if (threshold !== undefined) {
        url += `&threshold=${threshold}`;
      }
      const response = await apiClient.get(url);
      // API returns { success: true, data: [...] } or error response
      if (response.data && response.data.success !== false) {
        return { success: true, data: response.data.data || response.data || [] };
      } else {
        return { success: false, data: [], error: response.data?.message || 'Search failed' };
      }
    } catch (error: any) {
      // Handle 500 errors and other API errors gracefully
      const errorMessage = error.response?.data?.message || error.message || 'Search failed';
      return { success: false, data: [], error: errorMessage };
    }
  }

  async indexPath(path: string): Promise<ApiResponse<any>> {
    try {
      const response = await apiClient.post(API_ENDPOINTS.DOCUMENTS.INDEX, { path });
      return { success: true, data: response.data };
    } catch (error: any) {
      return { success: false, data: null, error: error.message || 'Indexing failed' };
    }
  }

  async testEmbeddingService(): Promise<ApiResponse<{ connected: boolean; dimensions: number }>> {
    try {
      const response = await apiClient.get(API_ENDPOINTS.DOCUMENTS.EMBEDDING_TEST);
      // API returns { success: true, data: {...} }
      return { success: true, data: response.data.data || response.data };
    } catch (error: any) {
      return { success: false, data: null as any, error: error.message || 'Test failed' };
    }
  }

  async clearAllDocuments(): Promise<ApiResponse<any>> {
    try {
      const response = await apiClient.delete('/documents/clear-all');
      return { success: true, data: response.data };
    } catch (error: any) {
      return { success: false, data: null, error: error.message || 'Clear failed' };
    }
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

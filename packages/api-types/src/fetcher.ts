import { apiClient } from './api-client';

export async function customFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || 'GET') as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  
  try {
    let response;
    let body = init?.body;
    
    // Parse body if it's a string (from generated code)
    if (body && typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // If parsing fails, keep as string
      }
    }
    
    switch (method) {
      case 'GET':
        response = await apiClient.get(url);
        break;
      case 'POST':
        response = await apiClient.post(url, body);
        break;
      case 'PUT':
        response = await apiClient.put(url, body);
        break;
      case 'DELETE':
        response = await apiClient.delete(url);
        break;
      case 'PATCH':
        response = await apiClient.patch(url, body);
        break;
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }
    
    return response as T;
  } catch (error) {
    // Re-throw the error to maintain compatibility with generated code
    throw error;
  }
}

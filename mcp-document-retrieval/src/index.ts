#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the MCP directory first, then API directory as fallback
const mcpEnvPath = path.resolve(__dirname, '../.env');
const apiEnvPath = path.resolve(__dirname, '../../apps/api/.env');
dotenv.config({ path: mcpEnvPath });
dotenv.config({ path: apiEnvPath });

// API configuration from environment
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

class DocumentRetrievalServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'document-retrieval-server',
        version: '3.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_documents',
            description: 'Search through indexed documents using hybrid search (keyword + semantic). Returns relevant document chunks with metadata.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The search query to find relevant documents',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results to return (default: 10)',
                  default: 10,
                },
                threshold: {
                  type: 'number',
                  description: 'Minimum similarity score threshold (default: 0.7)',
                  default: 0.7,
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'get_document_context',
            description: 'Get relevant context from documents for RAG (Retrieval-Augmented Generation).',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The query to find relevant context for',
                },
                maxChunks: {
                  type: 'number',
                  description: 'Maximum number of chunks to return (default: 5)',
                  default: 5,
                },
                threshold: {
                  type: 'number',
                  description: 'Minimum similarity score threshold (default: 0.7)',
                  default: 0.7,
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'get_document_stats',
            description: 'Get statistics about indexed documents.',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'list_documents',
            description: 'List all indexed documents.',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  description: 'Maximum number of documents (default: 20)',
                  default: 20,
                },
                offset: {
                  type: 'number',
                  description: 'Number of documents to skip (default: 0)',
                  default: 0,
                },
              },
            },
          },
          {
            name: 'test_embedding_service',
            description: 'Test the embedding service connection.',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ] satisfies Tool[],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_documents':
            return await this.searchDocuments(args);
          case 'get_document_context':
            return await this.getDocumentContext(args);
          case 'get_document_stats':
            return await this.getDocumentStats(args);
          case 'list_documents':
            return await this.listDocuments(args);
          case 'test_embedding_service':
            return await this.testEmbeddingService(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Error executing ${name}:`, error);
        return {
          content: [{
            type: 'text',
            text: `❌ Error: ${errorMessage}`,
          }],
          isError: true,
        };
      }
    });
  }

  private async searchDocuments(args: any) {
    const { query, limit = 10, threshold = 0.7 } = args;

    if (!query) {
      throw new Error('Query parameter is required');
    }

    try {
      console.error(`🔍 MCP: Searching for "${query}"`);
      
      const params = new URLSearchParams({
        query,
        limit: limit.toString(),
        threshold: threshold.toString(),
      });

      const url = `${API_BASE_URL}/documents/search?${params}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      const searchResults = result.data || result;

      if (searchResults.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `🔍 No documents found for: "${query}"`,
          }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: `🎯 Found ${searchResults.length} documents for "${query}":\n\n` +
            searchResults.map((r: any, i: number) =>
              `${i + 1}. **${r.documentTitle}** (Score: ${r.score.toFixed(3)})\n` +
              `   📁 ${r.documentPath}\n` +
              `   📄 ${r.content.substring(0, 200)}...\n`
            ).join('\n'),
        }],
      };
    } catch (error) {
      throw new Error(`Search failed: ${(error as Error).message}`);
    }
  }

  private async getDocumentContext(args: any) {
    const { query, maxChunks = 5, threshold = 0.7 } = args;

    if (!query) {
      throw new Error('Query parameter is required');
    }

    try {
      const params = new URLSearchParams({
        query,
        maxChunks: maxChunks.toString(),
        threshold: threshold.toString(),
      });

      const url = `${API_BASE_URL}/documents/context?${params}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      return {
        content: [{
          type: 'text',
          text: `📖 Context for "${query}":\n\n${JSON.stringify(result.data, null, 2)}`,
        }],
      };
    } catch (error) {
      throw new Error(`Context retrieval failed: ${(error as Error).message}`);
    }
  }

  private async getDocumentStats(args: any = {}) {
    try {
      const url = `${API_BASE_URL}/documents/stats`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      const stats = result.data || result;

      return {
        content: [{
          type: 'text',
          text: `📊 Document Statistics:\n\n${JSON.stringify(stats, null, 2)}`,
        }],
      };
    } catch (error) {
      throw new Error(`Stats retrieval failed: ${(error as Error).message}`);
    }
  }

  private async listDocuments(args: any = {}) {
    const { limit = 20, offset = 0 } = args;

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      const url = `${API_BASE_URL}/documents?${params}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      const documents = result.data || result;

      if (documents.length === 0) {
        return {
          content: [{
            type: 'text',
            text: '📄 No documents found.',
          }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: `📄 Documents (${documents.length}):\n\n` +
            documents.map((d: any, i: number) =>
              `${i + 1}. **${d.title}**\n   📁 ${d.path}\n`
            ).join('\n'),
        }],
      };
    } catch (error) {
      throw new Error(`List documents failed: ${(error as Error).message}`);
    }
  }

  private async testEmbeddingService(args: any = {}) {
    try {
      const url = `${API_BASE_URL}/documents/embedding/test`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();

      return {
        content: [{
          type: 'text',
          text: `🧪 Embedding Service Test:\n\n${JSON.stringify(result, null, 2)}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `🧪 Test Failed: ${(error as Error).message}`,
        }],
      };
    }
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('🚀 Document Retrieval MCP Server v3.0.0 (API-First Architecture)');
    console.error(`📡 Backend API: ${API_BASE_URL}`);
  }
}

const server = new DocumentRetrievalServer();
server.run().catch(console.error);

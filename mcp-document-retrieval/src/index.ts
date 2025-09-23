#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3002';

interface SearchResult {
  documentId: string;
  chunkId: string;
  documentPath: string;
  documentTitle: string;
  content: string;
  score: number;
  chunkIndex: number;
}

interface ContextResult {
  context: string;
  sources: Array<{
    documentPath: string;
    documentTitle: string;
    chunkIndex: number;
    score: number;
  }>;
}

class DocumentRetrievalServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'document-retrieval-server',
        version: '1.0.0',
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
            description: 'Search through indexed documents using semantic search',
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
            description: 'Get relevant context from documents for RAG (Retrieval-Augmented Generation)',
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
            description: 'Get statistics about the indexed documents',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'index_document',
            description: 'Index a specific file or directory',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Path to the file or directory to index',
                },
              },
              required: ['path'],
            },
          },
          {
            name: 'test_embedding_service',
            description: 'Test the embedding service connection',
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
            return await this.getDocumentStats();

          case 'index_document':
            return await this.indexDocument(args);

          case 'test_embedding_service':
            return await this.testEmbeddingService();

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${errorMessage}`,
            },
          ],
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

    const response = await axios.get(`${API_BASE_URL}/documents/search`, {
      params: { query, limit, threshold },
    });

    const results: SearchResult[] = response.data.data;

    return {
      content: [
        {
          type: 'text',
          text: `Found ${results.length} relevant documents for query: "${query}"\n\n` +
            results.map((result, index) => 
              `${index + 1}. **${result.documentTitle}** (Score: ${result.score.toFixed(3)})\n` +
              `   Path: ${result.documentPath}\n` +
              `   Content: ${result.content.substring(0, 200)}${result.content.length > 200 ? '...' : ''}\n`
            ).join('\n'),
        },
      ],
    };
  }

  private async getDocumentContext(args: any) {
    const { query, maxChunks = 5, threshold = 0.7 } = args;

    if (!query) {
      throw new Error('Query parameter is required');
    }

    const response = await axios.get(`${API_BASE_URL}/documents/context`, {
      params: { query, maxChunks, threshold },
    });

    const result: ContextResult = response.data.data;

    return {
      content: [
        {
          type: 'text',
          text: `**Context for query: "${query}"**\n\n` +
            `**Relevant Content:**\n${result.context}\n\n` +
            `**Sources:**\n` +
            result.sources.map((source, index) => 
              `${index + 1}. ${source.documentTitle} (Score: ${source.score.toFixed(3)})\n` +
              `   Path: ${source.documentPath}\n`
            ).join('\n'),
        },
      ],
    };
  }

  private async getDocumentStats() {
    const response = await axios.get(`${API_BASE_URL}/documents/stats`);
    const stats = response.data.data;

    return {
      content: [
        {
          type: 'text',
          text: `**Document Index Statistics:**\n\n` +
            `📄 Total Documents: ${stats.totalDocuments}\n` +
            `🧩 Total Chunks: ${stats.totalChunks}\n` +
            `📊 Average Chunk Size: ${stats.averageChunkSize} tokens\n` +
            `🔍 Documents with Embeddings: ${stats.documentsWithEmbeddings}\n` +
            `💾 Total Size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`,
        },
      ],
    };
  }

  private async indexDocument(args: any) {
    const { path } = args;

    if (!path) {
      throw new Error('Path parameter is required');
    }

    const response = await axios.post(`${API_BASE_URL}/documents/index`, { path });
    const result = response.data;

    return {
      content: [
        {
          type: 'text',
          text: `✅ ${result.message}\n\n` +
            (result.data ? `Document ID: ${result.data.id}\n` +
            `Title: ${result.data.title}\n` +
            `File Type: ${result.data.fileType}\n` +
            `File Size: ${(result.data.fileSize / 1024).toFixed(2)} KB` : ''),
        },
      ],
    };
  }

  private async testEmbeddingService() {
    const response = await axios.get(`${API_BASE_URL}/documents/embedding/test`);
    const result = response.data;

    return {
      content: [
        {
          type: 'text',
          text: `**Embedding Service Test:**\n\n` +
            `Status: ${result.success ? '✅ Connected' : '❌ Failed'}\n` +
            `Dimensions: ${result.data.dimensions}\n` +
            (result.error ? `Error: ${result.error}` : ''),
        },
      ],
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Document Retrieval MCP Server running on stdio');
  }
}

const server = new DocumentRetrievalServer();
server.run().catch(console.error);

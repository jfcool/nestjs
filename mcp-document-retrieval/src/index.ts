#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { DataSource } from 'typeorm';
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

// Database configuration
const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'joe',
  database: process.env.DB_NAME || 'nestjs_app',
  synchronize: false,
  logging: false,
  entities: [],
});

interface SearchResult {
  documentId: string;
  chunkId: string;
  documentPath: string;
  documentTitle: string;
  content: string;
  score: number;
  chunkIndex: number;
  documentType?: string;
  category?: string;
  importance?: number;
}

interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>;
  getDimensions(): number;
  testConnection(): Promise<boolean>;
}

class EmbeddingService implements EmbeddingProvider {
  private readonly provider: string;
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly model: string;
  private readonly dimensions: number;
  private readonly anthropicApiKey: string;
  private readonly ollamaUrl: string;
  private readonly ollamaModel: string;

  constructor() {
    this.provider = process.env.EMBEDDING_PROVIDER || 'openai';
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.apiUrl = process.env.EMBEDDING_API_URL || 'https://api.openai.com/v1/embeddings';
    this.model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
    this.dimensions = parseInt(process.env.EMBEDDING_DIMENSIONS || '1536', 10);
    this.anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.ollamaModel = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';
  }

  async generateEmbedding(text: string): Promise<number[]> {
    switch (this.provider.toLowerCase()) {
      case 'anthropic':
        return await this.generateAnthropicEmbedding(text);
      case 'openai':
        return await this.generateOpenAIEmbedding(text);
      case 'ollama':
        return await this.generateOllamaEmbedding(text);
      default:
        throw new Error(`Unsupported embedding provider: ${this.provider}`);
    }
  }

  getDimensions(): number {
    return this.dimensions;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.generateEmbedding('test connection');
      return true;
    } catch (error) {
      console.error(`Embedding service connection test failed: ${(error as Error).message}`);
      return false;
    }
  }

  private async generateOpenAIEmbedding(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text,
        model: this.model,
        dimensions: this.dimensions,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  private async generateAnthropicEmbedding(text: string): Promise<number[]> {
    throw new Error('Anthropic does not provide native embeddings. Use OpenAI or Ollama instead.');
  }

  private async generateOllamaEmbedding(text: string): Promise<number[]> {
    const response = await fetch(`${this.ollamaUrl}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.ollamaModel,
        prompt: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.embedding;
  }

}

class DocumentRetrievalServer {
  private server: Server;
  private dbInitialized = false;
  private embeddingService: EmbeddingService;

  constructor() {
    this.server = new Server(
      {
        name: 'document-retrieval-server',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.embeddingService = new EmbeddingService();
    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private async initializeDatabase(): Promise<void> {
    if (this.dbInitialized) return;
    
    try {
      await dataSource.initialize();
      this.dbInitialized = true;
      console.error('✅ Database connection initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize database connection:', error);
      throw error;
    }
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      if (this.dbInitialized) {
        await dataSource.destroy();
      }
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
            description: 'Search through indexed documents using semantic search with enhanced RAG scoring. Supports natural language queries and returns relevant document chunks with metadata.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The search query to find relevant documents (e.g., "invoices", "pilot training", "contracts")',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results to return (default: 10, max: 50)',
                  default: 10,
                  minimum: 1,
                  maximum: 50,
                },
                threshold: {
                  type: 'number',
                  description: 'Minimum similarity score threshold (default: 0.3, range: 0.0-1.0)',
                  default: 0.3,
                  minimum: 0.0,
                  maximum: 1.0,
                },
                documentType: {
                  type: 'string',
                  description: 'Filter by document type (e.g., "invoice", "contract", "certificate")',
                  optional: true,
                },
                category: {
                  type: 'string',
                  description: 'Filter by category (e.g., "financial", "legal", "technical")',
                  optional: true,
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'get_document_context',
            description: 'Get relevant context from documents for RAG (Retrieval-Augmented Generation). Returns formatted context suitable for AI responses.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The query to find relevant context for',
                },
                maxChunks: {
                  type: 'number',
                  description: 'Maximum number of chunks to return (default: 5, max: 20)',
                  default: 5,
                  minimum: 1,
                  maximum: 20,
                },
                threshold: {
                  type: 'number',
                  description: 'Minimum similarity score threshold (default: 0.3)',
                  default: 0.3,
                  minimum: 0.0,
                  maximum: 1.0,
                },
                includeMetadata: {
                  type: 'boolean',
                  description: 'Include document metadata in context (default: true)',
                  default: true,
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'get_document_stats',
            description: 'Get comprehensive statistics about the indexed documents including counts, types, categories, and embedding coverage.',
            inputSchema: {
              type: 'object',
              properties: {
                detailed: {
                  type: 'boolean',
                  description: 'Include detailed breakdown by type and category (default: false)',
                  default: false,
                },
              },
            },
          },
          {
            name: 'list_documents',
            description: 'List all indexed documents with optional filtering and pagination.',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  description: 'Maximum number of documents to return (default: 20, max: 100)',
                  default: 20,
                  minimum: 1,
                  maximum: 100,
                },
                offset: {
                  type: 'number',
                  description: 'Number of documents to skip (default: 0)',
                  default: 0,
                  minimum: 0,
                },
                documentType: {
                  type: 'string',
                  description: 'Filter by document type',
                  optional: true,
                },
                category: {
                  type: 'string',
                  description: 'Filter by category',
                  optional: true,
                },
                sortBy: {
                  type: 'string',
                  description: 'Sort by field (title, createdAt, importance, accessCount)',
                  default: 'createdAt',
                  enum: ['title', 'createdAt', 'importance', 'accessCount'],
                },
                sortOrder: {
                  type: 'string',
                  description: 'Sort order (asc, desc)',
                  default: 'desc',
                  enum: ['asc', 'desc'],
                },
              },
            },
          },
          {
            name: 'test_embedding_service',
            description: 'Test the embedding service connection and configuration. Returns service status and configuration details.',
            inputSchema: {
              type: 'object',
              properties: {
                testQuery: {
                  type: 'string',
                  description: 'Optional test query to generate embedding for (default: "test")',
                  default: 'test',
                },
              },
            },
          },
        ] satisfies Tool[],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        await this.initializeDatabase();

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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error(`❌ Error executing ${name}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error executing ${name}: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async searchDocuments(args: any) {
    const { 
      query, 
      limit = 10, 
      threshold = 0.3,
      documentType = null, 
      category = null 
    } = args;

    if (!query) {
      throw new Error('Query parameter is required');
    }

    try {
      console.error(`🔍 Searching for: "${query}" (limit: ${limit}, threshold: ${threshold})`);
      
      // Generate embedding for the query using the SAME service as the backend
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);
      console.error(`📊 Generated embedding with ${queryEmbedding.length} dimensions`);

      // Build dynamic WHERE clause for filters
      let whereClause = 'c.embedding IS NOT NULL';
      const queryParams: any[] = [`[${queryEmbedding.join(',')}]`, threshold];
      let paramIndex = 2;

      if (documentType) {
        whereClause += ` AND d."documentType" = $${++paramIndex}`;
        queryParams.push(documentType);
      }

      if (category) {
        whereClause += ` AND d.category = $${++paramIndex}`;
        queryParams.push(category);
      }

      // Direct embedding search query - NO FALLBACKS!
      const searchQuery = `
        SELECT 
          c.id as chunk_id,
          d.id as document_id,
          d.path as document_path,
          d.title as document_title,
          c.content,
          c.chunk_index as chunk_index,
          d."documentType" as document_type,
          d.category,
          d.importance,
          d."accessCount" as access_count,
          d."createdAt" as created_at,
          (1 - (c.embedding <=> $1::vector)) as similarity_score,
          (1 - (c.embedding <=> $1::vector)) * 
          COALESCE(d.importance, 1.0) * 
          (1 + COALESCE(d."accessCount", 0) * 0.02) as enhanced_score
        FROM chunks c
        JOIN documents d ON c.document_id = d.id
        WHERE ${whereClause}
          AND (1 - (c.embedding <=> $1::vector)) >= $2
        ORDER BY enhanced_score DESC
        LIMIT $${++paramIndex}
      `;

      queryParams.push(limit);
      const results = await dataSource.query(searchQuery, queryParams);
      console.error(`📋 Found ${results.length} results using embedding search`);

      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `🔍 No documents found for query: "${query}" with threshold ${threshold}\n\n` +
                `**Search parameters:**\n` +
                `- Embedding dimensions: ${queryEmbedding.length}\n` +
                `- Similarity threshold: ${threshold}\n` +
                `- Document type filter: ${documentType || 'none'}\n` +
                `- Category filter: ${category || 'none'}\n\n` +
                `**Suggestions:**\n` +
                `- Try lowering the threshold (e.g., 0.1)\n` +
                `- Remove filters to see all documents\n` +
                `- Check if documents have embeddings in the database`,
            },
          ],
        };
      }

      // Update access count for found documents
      const documentIds = [...new Set(results.map((r: any) => r.document_id))];
      if (documentIds.length > 0) {
        await dataSource.query(
          `UPDATE documents SET "accessCount" = COALESCE("accessCount", 0) + 1, "lastAccessedAt" = NOW() WHERE id = ANY($1)`,
          [documentIds]
        );
        console.error(`📈 Updated access count for ${documentIds.length} documents`);
      }

      const searchResults: SearchResult[] = results.map((row: any) => ({
        documentId: row.document_id,
        chunkId: row.chunk_id,
        documentPath: row.document_path,
        documentTitle: row.document_title,
        content: row.content,
        score: parseFloat(row.enhanced_score),
        chunkIndex: row.chunk_index,
        documentType: row.document_type,
        category: row.category,
        importance: row.importance,
      }));

      return {
        content: [
          {
            type: 'text',
            text: `🎯 Found ${searchResults.length} relevant documents for query: "${query}"\n\n` +
              searchResults.map((result, index) => 
                `**${index + 1}. ${result.documentTitle}** (Score: ${result.score.toFixed(3)})\n` +
                `   📁 **Path:** ${result.documentPath}\n` +
                `   📋 **Type:** ${result.documentType || 'unknown'} | **Category:** ${result.category || 'general'}\n` +
                `   ⭐ **Importance:** ${result.importance || 1.0} | **Chunk:** ${result.chunkIndex + 1}\n` +
                `   📄 **Content Preview:** ${result.content.substring(0, 200)}${result.content.length > 200 ? '...' : ''}\n`
              ).join('\n'),
          },
        ],
      };
    } catch (error) {
      console.error('❌ Search error:', error);
      throw new Error(`Search failed: ${(error as Error).message}`);
    }
  }

  private async getDocumentContext(args: any) {
    const { 
      query, 
      maxChunks = 5, 
      threshold = 0.3, 
      includeMetadata = true 
    } = args;

    if (!query) {
      throw new Error('Query parameter is required');
    }

    try {
      console.error(`📖 Getting context for: "${query}"`);
      
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);
      
      const contextQuery = `
        SELECT 
          d.path as document_path,
          d.title as document_title,
          d."documentType" as document_type,
          d.category,
          d.importance,
          c.content,
          c.chunk_index as chunk_index,
          (1 - (c.embedding <=> $1::vector)) as similarity_score,
          (1 - (c.embedding <=> $1::vector)) * 
          COALESCE(d.importance, 1.0) * 
          (1 + COALESCE(d."accessCount", 0) * 0.02) as score
        FROM chunks c
        JOIN documents d ON c.document_id = d.id
        WHERE c.embedding IS NOT NULL
          AND (1 - (c.embedding <=> $1::vector)) >= $2
        ORDER BY score DESC
        LIMIT $3
      `;

      const results = await dataSource.query(contextQuery, [
        `[${queryEmbedding.join(',')}]`,
        threshold,
        maxChunks
      ]);

      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `📖 No relevant context found for query: "${query}"\n\n` +
                `Try using different search terms or lowering the threshold to ${Math.max(0.1, threshold - 0.1)}.`,
            },
          ],
        };
      }

      const context = results.map((r: any) => r.content).join('\n\n---\n\n');
      const sources = results.map((r: any, index: number) => ({
        documentPath: r.document_path,
        documentTitle: r.document_title,
        documentType: r.document_type,
        category: r.category,
        importance: r.importance,
        chunkIndex: r.chunk_index,
        score: parseFloat(r.score),
      }));

      let responseText = `📖 **Context for query: "${query}"**\n\n`;
      
      if (includeMetadata) {
        responseText += `**📊 Context Summary:**\n`;
        responseText += `- Found ${results.length} relevant chunks\n`;
        responseText += `- Average relevance score: ${(sources.reduce((sum: number, s: any) => sum + s.score, 0) / sources.length).toFixed(3)}\n`;
        responseText += `- Document types: ${[...new Set(sources.map((s: any) => s.documentType))].join(', ')}\n\n`;
      }

      responseText += `**📄 Relevant Content:**\n${context}\n\n`;
      
      if (includeMetadata) {
        responseText += `**📚 Sources:**\n`;
        responseText += sources.map((source: any, index: number) =>
          `${index + 1}. **${source.documentTitle}** (Score: ${source.score.toFixed(3)})\n` +
          `   📁 Path: ${source.documentPath}\n` +
          `   📋 Type: ${source.documentType} | Category: ${source.category}\n` +
          `   ⭐ Importance: ${source.importance} | Chunk: ${source.chunkIndex + 1}\n`
        ).join('\n');
      }

      return {
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
      };
    } catch (error) {
      console.error('❌ Context retrieval error:', error);
      throw new Error(`Context retrieval failed: ${(error as Error).message}`);
    }
  }

  private async getDocumentStats(args: any = {}) {
    const { detailed = false } = args;

    try {
      const basicStatsQuery = `
        SELECT 
          COUNT(DISTINCT d.id) as total_documents,
          COUNT(c.id) as total_chunks,
          AVG(LENGTH(c.content)) as avg_chunk_size,
          COUNT(CASE WHEN c.embedding IS NOT NULL THEN 1 END) as chunks_with_embeddings,
          SUM(d."fileSize") as total_size,
          AVG(d.importance) as avg_importance,
          SUM(d."accessCount") as total_access_count
        FROM documents d
        LEFT JOIN chunks c ON d.id = c.document_id
      `;

      const [basicStats] = await dataSource.query(basicStatsQuery);

      let responseText = `📊 **Document Index Statistics**\n\n`;
      responseText += `📄 **Total Documents:** ${basicStats.total_documents || 0}\n`;
      responseText += `🧩 **Total Chunks:** ${basicStats.total_chunks || 0}\n`;
      responseText += `📊 **Average Chunk Size:** ${Math.round(basicStats.avg_chunk_size || 0)} characters\n`;
      responseText += `🔍 **Chunks with Embeddings:** ${basicStats.chunks_with_embeddings || 0}\n`;
      responseText += `💾 **Total Size:** ${((basicStats.total_size || 0) / 1024 / 1024).toFixed(2)} MB\n`;
      responseText += `⭐ **Average Importance:** ${(basicStats.avg_importance || 1.0).toFixed(2)}\n`;
      responseText += `👁️ **Total Access Count:** ${basicStats.total_access_count || 0}\n`;
      responseText += `🎯 **Embedding Coverage:** ${basicStats.total_chunks > 0 ? ((basicStats.chunks_with_embeddings / basicStats.total_chunks) * 100).toFixed(1) : 0}%\n`;

      if (detailed) {
        const typeStatsQuery = `
          SELECT 
            d.documentType as document_type,
            d.category,
            COUNT(DISTINCT d.id) as document_count,
            COUNT(c.id) as chunk_count,
            AVG(d.importance) as avg_importance,
            SUM(d."accessCount") as total_access_count
          FROM documents d
          LEFT JOIN chunks c ON d.id = c.document_id
          GROUP BY d.documentType, d.category
          ORDER BY document_count DESC
        `;

        const typeStats = await dataSource.query(typeStatsQuery);

        if (typeStats.length > 0) {
          responseText += `\n📋 **Breakdown by Type and Category:**\n`;
          typeStats.forEach((stat: any) => {
            responseText += `\n**${stat.document_type || 'Unknown'} - ${stat.category || 'General'}:**\n`;
            responseText += `  📄 Documents: ${stat.document_count}\n`;
            responseText += `  🧩 Chunks: ${stat.chunk_count}\n`;
            responseText += `  ⭐ Avg Importance: ${(stat.avg_importance || 1.0).toFixed(2)}\n`;
            responseText += `  👁️ Access Count: ${stat.total_access_count || 0}\n`;
          });
        }

        // Most accessed documents
        const topDocsQuery = `
          SELECT 
            d.title,
            d.path,
            d.documentType,
            d.accessCount,
            d.lastAccessedAt
          FROM documents d
          WHERE d.accessCount > 0
          ORDER BY d."accessCount" DESC, d."lastAccessedAt" DESC
          LIMIT 5
        `;

        const topDocs = await dataSource.query(topDocsQuery);

        if (topDocs.length > 0) {
          responseText += `\n🔥 **Most Accessed Documents:**\n`;
          topDocs.forEach((doc: any, index: number) => {
            responseText += `${index + 1}. **${doc.title}** (${doc.access_count} accesses)\n`;
            responseText += `   📁 Path: ${doc.path}\n`;
            responseText += `   📋 Type: ${doc.document_type}\n`;
            responseText += `   🕒 Last accessed: ${new Date(doc.last_accessed_at).toLocaleDateString()}\n\n`;
          });
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
      };
    } catch (error) {
      console.error('❌ Stats retrieval error:', error);
      throw new Error(`Stats retrieval failed: ${(error as Error).message}`);
    }
  }

  private async listDocuments(args: any = {}) {
    const { 
      limit = 20, 
      offset = 0, 
      documentType = null, 
      category = null, 
      sortBy = 'createdAt', 
      sortOrder = 'desc' 
    } = args;

    try {
      // Build dynamic WHERE clause for filters
      let whereClause = '1=1';
      const queryParams: any[] = [];
      let paramIndex = 0;

      if (documentType) {
        whereClause += ` AND d.documentType = $${++paramIndex}`;
        queryParams.push(documentType);
      }

      if (category) {
        whereClause += ` AND d.category = $${++paramIndex}`;
        queryParams.push(category);
      }

      // Validate sort parameters
      const validSortFields = ['title', 'createdAt', 'importance', 'accessCount'];
      const validSortOrders = ['asc', 'desc'];
      
      const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
      const safeSortOrder = validSortOrders.includes(sortOrder.toLowerCase()) ? sortOrder.toUpperCase() : 'DESC';

      const listQuery = `
        SELECT 
          d.id,
          d.title,
          d.path,
          d.documentType as document_type,
          d.category,
          d.importance,
          d.accessCount as access_count,
          d.fileSize as file_size,
          d.createdAt as created_at,
          d.lastAccessedAt as last_accessed_at,
          COUNT(c.id) as chunk_count
        FROM documents d
        LEFT JOIN chunks c ON d.id = c.document_id
        WHERE ${whereClause}
        GROUP BY d.id, d.title, d.path, d.documentType, d.category, d.importance, d.accessCount, d.fileSize, d.createdAt, d.lastAccessedAt
        ORDER BY d.${safeSortBy} ${safeSortOrder}
        LIMIT $${++paramIndex} OFFSET $${++paramIndex}
      `;

      queryParams.push(limit, offset);

      const documents = await dataSource.query(listQuery, queryParams);

      // Get total count for pagination
      const countQuery = `
        SELECT COUNT(DISTINCT d.id) as total
        FROM documents d
        WHERE ${whereClause}
      `;

      const [{ total }] = await dataSource.query(countQuery, queryParams.slice(0, -2));

      if (documents.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `📄 No documents found.\n\n` +
                `**Filters Applied:**\n` +
                `- Document type: ${documentType || 'none'}\n` +
                `- Category: ${category || 'none'}\n` +
                `- Offset: ${offset}\n\n` +
                `Try removing filters or adjusting the offset.`,
            },
          ],
        };
      }

      let responseText = `📄 **Document List** (${documents.length} of ${total} total)\n\n`;
      responseText += `**Filters:** Type: ${documentType || 'all'}, Category: ${category || 'all'}\n`;
      responseText += `**Sort:** ${safeSortBy} ${safeSortOrder.toLowerCase()}\n`;
      responseText += `**Pagination:** ${offset + 1}-${offset + documents.length} of ${total}\n\n`;

      documents.forEach((doc: any, index: number) => {
        responseText += `**${offset + index + 1}. ${doc.title}**\n`;
        responseText += `   📁 **Path:** ${doc.path}\n`;
        responseText += `   📋 **Type:** ${doc.document_type || 'unknown'} | **Category:** ${doc.category || 'general'}\n`;
        responseText += `   ⭐ **Importance:** ${doc.importance || 1.0} | **Chunks:** ${doc.chunk_count}\n`;
        responseText += `   💾 **Size:** ${((doc.file_size || 0) / 1024).toFixed(1)} KB | **Access Count:** ${doc.access_count || 0}\n`;
        responseText += `   🕒 **Created:** ${new Date(doc.created_at).toLocaleDateString()}`;
        if (doc.last_accessed_at) {
          responseText += ` | **Last Accessed:** ${new Date(doc.last_accessed_at).toLocaleDateString()}`;
        }
        responseText += `\n\n`;
      });

      if (offset + limit < total) {
        responseText += `📄 **Next Page:** Use offset ${offset + limit} to see more documents.`;
      }

      return {
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
      };
    } catch (error) {
      console.error('❌ List documents error:', error);
      throw new Error(`List documents failed: ${(error as Error).message}`);
    }
  }

  private async testEmbeddingService(args: any = {}) {
    const { testQuery = 'test' } = args;

    try {
      console.error(`🧪 Testing embedding service with query: "${testQuery}"`);
      
      const startTime = Date.now();
      const isConnected = await this.embeddingService.testConnection();
      const endTime = Date.now();
      
      let responseText = `🧪 **Embedding Service Test Results**\n\n`;
      responseText += `**Connection Status:** ${isConnected ? '✅ Connected' : '❌ Failed'}\n`;
      responseText += `**Response Time:** ${endTime - startTime}ms\n`;
      responseText += `**Provider:** ${process.env.EMBEDDING_PROVIDER || 'openai'}\n`;
      responseText += `**Model:** ${process.env.EMBEDDING_MODEL || 'text-embedding-3-small'}\n`;
      responseText += `**Dimensions:** ${this.embeddingService.getDimensions()}\n\n`;

      if (isConnected) {
        try {
          const testEmbedding = await this.embeddingService.generateEmbedding(testQuery);
          responseText += `**Test Embedding Generated:** ✅\n`;
          responseText += `**Embedding Length:** ${testEmbedding.length}\n`;
          responseText += `**Sample Values:** [${testEmbedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]\n`;
          responseText += `**Magnitude:** ${Math.sqrt(testEmbedding.reduce((sum, val) => sum + val * val, 0)).toFixed(4)}\n\n`;
          
          // Test database connection
          const testDbQuery = 'SELECT COUNT(*) as count FROM documents LIMIT 1';
          await dataSource.query(testDbQuery);
          responseText += `**Database Connection:** ✅ Connected\n`;
          responseText += `**Database:** ${process.env.DB_DATABASE || 'nestjs_db'}\n`;
          responseText += `**Host:** ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}\n`;
          
        } catch (embeddingError) {
          responseText += `**Test Embedding:** ❌ Failed\n`;
          responseText += `**Error:** ${(embeddingError as Error).message}\n`;
        }
      } else {
        responseText += `**Configuration Issues:**\n`;
        if (!process.env.OPENAI_API_KEY && process.env.EMBEDDING_PROVIDER === 'openai') {
          responseText += `- ❌ OpenAI API key not configured\n`;
        }
        if (!process.env.ANTHROPIC_API_KEY && process.env.EMBEDDING_PROVIDER === 'anthropic') {
          responseText += `- ❌ Anthropic API key not configured\n`;
        }
        responseText += `- 💡 Using fallback embedding generation\n`;
      }

      return {
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
      };
    } catch (error) {
      console.error('❌ Embedding service test error:', error);
      return {
        content: [
          {
            type: 'text',
            text: `🧪 **Embedding Service Test Failed**\n\n` +
              `**Error:** ${(error as Error).message}\n` +
              `**Status:** ❌ Service unavailable`,
          },
        ],
      };
    }
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('🚀 Document Retrieval MCP Server v2.0.0 running on stdio');
    console.error(`📊 Embedding Provider: ${process.env.EMBEDDING_PROVIDER || 'openai'}`);
    console.error(`🔧 Embedding Model: ${process.env.EMBEDDING_MODEL || 'text-embedding-3-small'}`);
    console.error(`📐 Embedding Dimensions: ${process.env.EMBEDDING_DIMENSIONS || '1536'}`);
  }
}

const server = new DocumentRetrievalServer();
server.run().catch(console.error);

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { McpClientService, McpTool as RealMcpTool, McpResource as RealMcpResource } from './mcp-client.service';

export interface McpServer {
  name: string;
  url: string;
  description: string;
  tools: McpTool[];
  resources: McpResource[];
}

export interface McpServerConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
  disabled: boolean;
  autoApprove?: string[];
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: any;
}

export interface McpResource {
  uri: string;
  name: string;
  description: string;
}

export interface McpToolCall {
  serverName: string;
  toolName: string;
  arguments: any;
}

export interface McpToolResult {
  success: boolean;
  result?: any;
  error?: string;
}

@Injectable()
export class McpService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(McpService.name);
  private mcpServers: Map<string, McpServer> = new Map();
  private mcpServerConfigs: Map<string, McpServerConfig> = new Map();
  private toolsCache: Map<string, McpTool[]> = new Map();
  private resourcesCache: Map<string, McpResource[]> = new Map();
  private configFilePath: string;
  private mcpClient: McpClientService;

  constructor() {
    this.mcpClient = new McpClientService();
    // Handle both monorepo and standalone scenarios
    const possiblePaths = [
      path.join(process.cwd(), 'conf.json'),
      path.join(process.cwd(), 'apps/api/conf.json'),
      path.join(__dirname, '../../../conf.json'),
    ];
    
    this.configFilePath = possiblePaths.find(p => {
      try {
        require('fs').accessSync(p);
        return true;
      } catch {
        return false;
      }
    }) || possiblePaths[0];

    // Initialize with available MCP servers
    this.initializeMcpServers();
  }

  private initializeMcpServers() {
    try {
      // Load MCP server configurations from conf.json
      const configData = fs.readFileSync(this.configFilePath, 'utf8');
      const config = JSON.parse(configData);

      if (config.mcpServers) {
        Object.entries(config.mcpServers).forEach(([serverName, serverConfig]: [string, any]) => {
          if (!serverConfig.disabled) {
            this.mcpServerConfigs.set(serverName, serverConfig);
            
            // Create MCP server based on configuration
            const mcpServer = this.createMcpServerFromConfig(serverName, serverConfig);
            this.mcpServers.set(serverName, mcpServer);
            
            this.logger.log(`Loaded MCP server: ${serverName}`);
          } else {
            this.logger.log(`MCP server disabled: ${serverName}`);
          }
        });
      }


      this.logger.log(`Initialized ${this.mcpServers.size} MCP servers`);
    } catch (error) {
      this.logger.error(`Failed to load MCP server configuration: ${error.message}`);
      this.logger.log('Initialized MCP servers with fallback configuration');
    }
  }

  private createMcpServerFromConfig(serverName: string, config: McpServerConfig): McpServer {
    // Create a basic MCP server structure from configuration
    // In a real implementation, you would connect to the actual MCP server
    // and discover its tools and resources dynamically
    
    const tools: McpTool[] = [];
    const resources: McpResource[] = [];

    // Add some default tools based on server name/type
    if (serverName.includes('sap') || serverName.includes('abap')) {
      tools.push(
        {
          name: 'classComponents',
          description: 'Get class components from SAP system',
          inputSchema: {
            type: 'object',
            properties: {
              className: { type: 'string' }
            }
          }
        },
        {
          name: 'searchObject',
          description: 'Search for objects in SAP system',
          inputSchema: {
            type: 'object',
            properties: {
              objectType: { type: 'string' },
              searchTerm: { type: 'string' }
            }
          }
        },
        {
          name: 'objectStructure',
          description: 'Get object structure from SAP system',
          inputSchema: {
            type: 'object',
            properties: {
              objectName: { type: 'string' },
              objectType: { type: 'string' }
            }
          }
        },
        {
          name: 'getObjectSource',
          description: 'Get source code of SAP object',
          inputSchema: {
            type: 'object',
            properties: {
              objectName: { type: 'string' },
              objectType: { type: 'string' }
            }
          }
        },
        {
          name: 'tableContents',
          description: 'Get table contents from SAP system',
          inputSchema: {
            type: 'object',
            properties: {
              tableName: { type: 'string' },
              maxRows: { type: 'number' }
            }
          }
        }
      );
    }

    if (serverName.includes('agentdb')) {
      tools.push(
        {
          name: 'query',
          description: 'Execute query on AgentDB',
          inputSchema: {
            type: 'object',
            properties: {
              sql: { type: 'string' },
              parameters: { type: 'array' }
            }
          }
        },
        {
          name: 'insert',
          description: 'Insert data into AgentDB',
          inputSchema: {
            type: 'object',
            properties: {
              table: { type: 'string' },
              data: { type: 'object' }
            }
          }
        },
        {
          name: 'update',
          description: 'Update data in AgentDB',
          inputSchema: {
            type: 'object',
            properties: {
              table: { type: 'string' },
              data: { type: 'object' },
              where: { type: 'object' }
            }
          }
        }
      );
    }

    if (serverName === 'document-retrieval') {
      tools.push(
        {
          name: 'search_documents',
          description: 'Search documents using semantic vector search',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              limit: { type: 'number', description: 'Maximum number of results', default: 5 },
              threshold: { type: 'number', description: 'Similarity threshold', default: 0.1 }
            },
            required: ['query']
          }
        },
        {
          name: 'get_document_context',
          description: 'Get relevant document context for RAG applications',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Context query' },
              maxChunks: { type: 'number', description: 'Maximum chunks to return', default: 5 },
              threshold: { type: 'number', description: 'Relevance threshold', default: 0.7 }
            },
            required: ['query']
          }
        },
        {
          name: 'get_document_stats',
          description: 'Get statistics about indexed documents',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'test_embedding_service',
          description: 'Test the embedding service connection',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        }
      );
    }

    if (serverName === 'everest-SAP-system') {
      tools.push(
        {
          name: 'search-sap-services',
          description: 'Search and filter available SAP OData services',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              category: { type: 'string' },
              limit: { type: 'number' }
            }
          }
        },
        {
          name: 'discover-service-entities',
          description: 'List all entities within a specific SAP service',
          inputSchema: {
            type: 'object',
            properties: {
              serviceId: { type: 'string' },
              showCapabilities: { type: 'boolean' }
            }
          }
        },
        {
          name: 'get-entity-schema',
          description: 'Get detailed schema information for a specific entity',
          inputSchema: {
            type: 'object',
            properties: {
              serviceId: { type: 'string' },
              entityName: { type: 'string' }
            }
          }
        },
        {
          name: 'execute-entity-operation',
          description: 'Perform CRUD operations on SAP entities',
          inputSchema: {
            type: 'object',
            properties: {
              serviceId: { type: 'string' },
              entityName: { type: 'string' },
              operation: { type: 'string' },
              parameters: { type: 'object' },
              queryOptions: { type: 'object' }
            }
          }
        }
      );

      resources.push({
        uri: 'sap://services',
        name: 'sap-services',
        description: 'List of all discovered SAP OData services'
      });
    }

    return {
      name: serverName,
      url: `mcp://${serverName}`,
      description: `MCP server: ${serverName}`,
      tools,
      resources
    };
  }

  getServerConfig(serverName: string): McpServerConfig | undefined {
    return this.mcpServerConfigs.get(serverName);
  }

  async onModuleInit() {
    this.logger.log('Starting MCP servers...');
    
    // Start real MCP servers for configured servers
    for (const [serverName, config] of this.mcpServerConfigs) {
      try {
        const started = await this.mcpClient.startServer(serverName, config);
        if (started) {
          // Update server with real tools and resources
          const tools = await this.mcpClient.listTools(serverName);
          const resources = await this.mcpClient.listResources(serverName);
          
          const server = this.mcpServers.get(serverName);
          if (server) {
            server.tools = tools.map(t => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema
            }));
            server.resources = resources.map(r => ({
              uri: r.uri,
              name: r.name,
              description: r.description || ''
            }));
          }
          
          this.logger.log(`MCP server ${serverName} started with ${tools.length} tools and ${resources.length} resources`);
        }
      } catch (error) {
        this.logger.error(`Failed to start MCP server ${serverName}: ${error.message}`);
      }
    }
  }

  async onModuleDestroy() {
    this.logger.log('Stopping MCP servers...');
    await this.mcpClient.stopAllServers();
  }

  async reloadConfiguration(): Promise<void> {
    this.logger.log('Reloading MCP server configuration...');
    
    // Stop all running servers first
    await this.mcpClient.stopAllServers();
    
    // Clear all caches and configurations
    this.mcpServers.clear();
    this.mcpServerConfigs.clear();
    this.clearAllCaches();
    
    // Reinitialize from config file
    this.initializeMcpServers();
    
    // Restart enabled servers
    for (const [serverName, config] of this.mcpServerConfigs) {
      try {
        const started = await this.mcpClient.startServer(serverName, config);
        if (started) {
          // Update server with real tools and resources
          const tools = await this.mcpClient.listTools(serverName);
          const resources = await this.mcpClient.listResources(serverName);
          
          const server = this.mcpServers.get(serverName);
          if (server) {
            server.tools = tools.map(t => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema
            }));
            server.resources = resources.map(r => ({
              uri: r.uri,
              name: r.name,
              description: r.description || ''
            }));
          }
          
          this.logger.log(`MCP server ${serverName} restarted with ${tools.length} tools and ${resources.length} resources`);
        }
      } catch (error) {
        this.logger.error(`Failed to restart MCP server ${serverName}: ${error.message}`);
      }
    }
    
    this.logger.log('MCP configuration reloaded successfully');
  }

  getAvailableServers(): McpServer[] {
    return Array.from(this.mcpServers.values());
  }

  getAllServersWithStatus(): Array<McpServer & { disabled: boolean }> {
    try {
      // Load current configuration to get all servers including disabled ones
      const configData = fs.readFileSync(this.configFilePath, 'utf8');
      const config = JSON.parse(configData);
      
      const allServers: Array<McpServer & { disabled: boolean }> = [];
      
      if (config.mcpServers) {
        Object.entries(config.mcpServers).forEach(([serverName, serverConfig]: [string, any]) => {
          const isDisabled = serverConfig.disabled === true;
          
          if (isDisabled) {
            // Create a basic server structure for disabled servers
            const disabledServer = this.createMcpServerFromConfig(serverName, serverConfig);
            allServers.push({
              ...disabledServer,
              disabled: true
            });
          } else {
            // Get the active server
            const activeServer = this.mcpServers.get(serverName);
            if (activeServer) {
              allServers.push({
                ...activeServer,
                disabled: false
              });
            }
          }
        });
      }
      
      return allServers;
    } catch (error) {
      this.logger.error(`Failed to get all servers with status: ${error.message}`);
      // Fallback to active servers only
      return Array.from(this.mcpServers.values()).map(server => ({
        ...server,
        disabled: false
      }));
    }
  }

  getServer(serverName: string): McpServer | undefined {
    return this.mcpServers.get(serverName);
  }

  /**
   * Dynamically discover and cache tools for a given MCP server
   */
  async discoverAndCacheTools(serverName: string): Promise<McpTool[]> {
    // Check if tools are already cached
    if (this.toolsCache.has(serverName)) {
      return this.toolsCache.get(serverName)!;
    }

    try {
      // If server is running, get real tools
      if (this.mcpClient.isServerRunning(serverName)) {
        const realTools = await this.mcpClient.listTools(serverName);
        const tools: McpTool[] = realTools.map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema
        }));
        
        // Cache the tools
        this.toolsCache.set(serverName, tools);
        this.logger.log(`Cached ${tools.length} tools for MCP server: ${serverName}`);
        
        // Update the server object as well
        const server = this.mcpServers.get(serverName);
        if (server) {
          server.tools = tools;
        }
        
        return tools;
      }
      
      // Fallback to server configuration or empty array
      const server = this.mcpServers.get(serverName);
      const tools = server?.tools || [];
      this.toolsCache.set(serverName, tools);
      return tools;
      
    } catch (error) {
      this.logger.error(`Failed to discover tools for ${serverName}: ${error.message}`);
      return [];
    }
  }

  /**
   * Dynamically discover and cache resources for a given MCP server
   */
  async discoverAndCacheResources(serverName: string): Promise<McpResource[]> {
    // Check if resources are already cached
    if (this.resourcesCache.has(serverName)) {
      return this.resourcesCache.get(serverName)!;
    }

    try {
      // If server is running, get real resources
      if (this.mcpClient.isServerRunning(serverName)) {
        const realResources = await this.mcpClient.listResources(serverName);
        const resources: McpResource[] = realResources.map(r => ({
          uri: r.uri,
          name: r.name,
          description: r.description || ''
        }));
        
        // Cache the resources
        this.resourcesCache.set(serverName, resources);
        this.logger.log(`Cached ${resources.length} resources for MCP server: ${serverName}`);
        
        // Update the server object as well
        const server = this.mcpServers.get(serverName);
        if (server) {
          server.resources = resources;
        }
        
        return resources;
      }
      
      // Fallback to server configuration or empty array
      const server = this.mcpServers.get(serverName);
      const resources = server?.resources || [];
      this.resourcesCache.set(serverName, resources);
      return resources;
      
    } catch (error) {
      this.logger.error(`Failed to discover resources for ${serverName}: ${error.message}`);
      return [];
    }
  }

  /**
   * Get available tools for a server, using cache or discovering dynamically
   */
  async getAvailableTools(serverName: string): Promise<McpTool[]> {
    return await this.discoverAndCacheTools(serverName);
  }

  /**
   * Get available resources for a server, using cache or discovering dynamically
   */
  async getAvailableResources(serverName: string): Promise<McpResource[]> {
    return await this.discoverAndCacheResources(serverName);
  }

  /**
   * Clear cache for a specific server (useful for refreshing)
   */
  clearServerCache(serverName: string): void {
    this.toolsCache.delete(serverName);
    this.resourcesCache.delete(serverName);
    this.logger.log(`Cleared cache for MCP server: ${serverName}`);
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.toolsCache.clear();
    this.resourcesCache.clear();
    this.logger.log('Cleared all MCP server caches');
  }

  async executeTool(toolCall: McpToolCall, authToken?: string): Promise<McpToolResult> {
    try {
      const server = this.mcpServers.get(toolCall.serverName);
      if (!server) {
        return {
          success: false,
          error: `MCP server '${toolCall.serverName}' not found`
        };
      }

      const tool = server.tools.find(t => t.name === toolCall.toolName);
      if (!tool) {
        return {
          success: false,
          error: `Tool '${toolCall.toolName}' not found on server '${toolCall.serverName}'`
        };
      }

      this.logger.log(`Executing MCP tool: ${toolCall.serverName}.${toolCall.toolName}`);
      
      // For the document-retrieval system, always use the direct API call with auth token
      if (toolCall.serverName === 'document-retrieval') {
        return await this.executeDocumentRetrievalTool(toolCall, authToken);
      }
      
      // Check if this is a real MCP server that we should call
      if (this.mcpClient.isServerRunning(toolCall.serverName)) {
        try {
          // For mcp-abap-abap-adt-api, we need to login first and handle connectivity issues
          if (toolCall.serverName === 'mcp-abap-abap-adt-api') {
            try {
              await this.mcpClient.callTool(toolCall.serverName, 'login', {});
            } catch (loginError) {
              this.logger.warn(`Login failed for ${toolCall.serverName}: ${loginError.message}`);
              return {
                success: false,
                error: `SAP System nicht erreichbar. Es gab einen Timeout-Fehler bei der Verbindung zum SAP System. Bitte überprüfen Sie die Netzwerkverbindung oder wenden Sie sich an Ihren SAP-Administrator.`
              };
            }
          }
          
          const result = await this.mcpClient.callTool(
            toolCall.serverName,
            toolCall.toolName,
            toolCall.arguments
          );
          return {
            success: true,
            result: result
          };
        } catch (error) {
          this.logger.error(`MCP tool call failed: ${error.message}`);
          
          // Provide user-friendly error messages for SAP connectivity issues
          if (toolCall.serverName === 'mcp-abap-abap-adt-api') {
            if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
              return {
                success: false,
                error: `SAP System nicht erreichbar. Es gab einen Verbindungsfehler zum SAP System. Bitte überprüfen Sie die Netzwerkverbindung oder wenden Sie sich an Ihren SAP-Administrator.`
              };
            }
          }
          
          return {
            success: false,
            error: error.message
          };
        }
      }
      
      // For the SAP system, we can provide more realistic responses
      if (toolCall.serverName === 'everest-SAP-system') {
        return await this.executeSapTool(toolCall);
      }
      
      // Default simulation for other servers
      return {
        success: true,
        result: {
          toolName: toolCall.toolName,
          serverName: toolCall.serverName,
          arguments: toolCall.arguments,
          response: 'MCP tool executed successfully (simulated)'
        }
      };
    } catch (error) {
      this.logger.error(`Error executing MCP tool: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  private async executeDocumentRetrievalTool(toolCall: McpToolCall, authToken?: string): Promise<McpToolResult> {
    const axios = require('axios');
    
    try {
      // Use provided user token if available, otherwise fall back to admin token
      let token = authToken;
      
      if (!token) {
        // Fallback: Get admin token for internal API calls
        const loginResponse = await axios.post('http://localhost:3001/auth/login', {
          username: 'admin',
          password: 'admin'
        });
        token = loginResponse.data.access_token;
      }
      
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      
      switch (toolCall.toolName) {
        case 'search_documents':
          const searchUrl = `http://localhost:3001/documents/search?query=${encodeURIComponent(toolCall.arguments.query)}&limit=${toolCall.arguments.limit || 5}&threshold=${toolCall.arguments.threshold || 0.1}`;
          const searchResponse = await axios.get(searchUrl, { headers });
          
          // Log the actual response to debug
          this.logger.log(`Search API Response: ${JSON.stringify(searchResponse.data).substring(0, 500)}`);
          
          const results = searchResponse.data.data || [];
          const resultsCount = results.length;
          
          return {
            success: true,
            result: {
              query: toolCall.arguments.query,
              results: results,
              resultsCount: resultsCount,
              message: `Found ${resultsCount} documents matching "${toolCall.arguments.query}"`
            }
          };

        case 'get_document_context':
          const contextUrl = `http://localhost:3001/documents/context?query=${encodeURIComponent(toolCall.arguments.query)}&maxChunks=${toolCall.arguments.maxChunks || 5}&threshold=${toolCall.arguments.threshold || 0.7}`;
          const contextResponse = await axios.get(contextUrl, { headers });
          
          return {
            success: true,
            result: {
              query: toolCall.arguments.query,
              context: contextResponse.data.data,
              message: `Retrieved context for "${toolCall.arguments.query}"`
            }
          };

        case 'get_document_stats':
          const statsResponse = await axios.get('http://localhost:3001/documents/stats', { headers });
          
          return {
            success: true,
            result: {
              stats: statsResponse.data.data,
              message: 'Document statistics retrieved successfully'
            }
          };

        case 'test_embedding_service':
          const testResponse = await axios.get('http://localhost:3001/documents/embedding/test', { headers });
          
          return {
            success: true,
            result: {
              connected: testResponse.data.data.connected,
              dimensions: testResponse.data.data.dimensions,
              message: `Embedding service is ${testResponse.data.data.connected ? 'connected' : 'disconnected'}`
            }
          };

        default:
          return {
            success: false,
            error: `Unknown document-retrieval tool: ${toolCall.toolName}`
          };
      }
    } catch (error) {
      this.logger.error(`Document retrieval tool error: ${error.message}`);
      return {
        success: false,
        error: `Document retrieval failed: ${error.message}`
      };
    }
  }

  private async executeSapTool(toolCall: McpToolCall): Promise<McpToolResult> {
    switch (toolCall.toolName) {
      case 'search-sap-services':
        return {
          success: true,
          result: {
            services: [
              {
                id: 'API_BUSINESS_PARTNER',
                name: 'Business Partner API',
                description: 'Manage business partner master data',
                category: 'business-partner',
                version: '1.0.0'
              },
              {
                id: 'API_SALES_ORDER_SRV',
                name: 'Sales Order API',
                description: 'Create and manage sales orders',
                category: 'sales',
                version: '1.0.0'
              },
              {
                id: 'API_PURCHASE_ORDER_PROCESS_SRV',
                name: 'Purchase Order API',
                description: 'Process purchase orders',
                category: 'procurement',
                version: '1.0.0'
              }
            ],
            totalCount: 3,
            query: toolCall.arguments.query || '',
            category: toolCall.arguments.category || 'all'
          }
        };

      case 'discover-service-entities':
        return {
          success: true,
          result: {
            serviceId: toolCall.arguments.serviceId,
            entities: [
              {
                name: 'BusinessPartner',
                description: 'Business Partner entity',
                capabilities: {
                  create: true,
                  read: true,
                  update: true,
                  delete: false
                }
              },
              {
                name: 'BusinessPartnerAddress',
                description: 'Business Partner Address entity',
                capabilities: {
                  create: true,
                  read: true,
                  update: true,
                  delete: true
                }
              }
            ]
          }
        };

      case 'get-entity-schema':
        return {
          success: true,
          result: {
            serviceId: toolCall.arguments.serviceId,
            entityName: toolCall.arguments.entityName,
            schema: {
              properties: {
                BusinessPartner: { type: 'string', key: true },
                BusinessPartnerCategory: { type: 'string' },
                BusinessPartnerFullName: { type: 'string' },
                CreatedByUser: { type: 'string' },
                CreationDate: { type: 'date' }
              },
              keys: ['BusinessPartner'],
              navigationProperties: ['to_BusinessPartnerAddress']
            }
          }
        };

      case 'execute-entity-operation':
        return {
          success: true,
          result: {
            operation: toolCall.arguments.operation,
            entityName: toolCall.arguments.entityName,
            data: 'Operation executed successfully (simulated)',
            recordsAffected: 1
          }
        };

      default:
        return {
          success: false,
          error: `Unknown SAP tool: ${toolCall.toolName}`
        };
    }
  }

  async getResource(serverName: string, uri: string): Promise<McpToolResult> {
    try {
      const server = this.mcpServers.get(serverName);
      if (!server) {
        return {
          success: false,
          error: `MCP server '${serverName}' not found`
        };
      }

      const resource = server.resources.find(r => r.uri === uri);
      if (!resource) {
        return {
          success: false,
          error: `Resource '${uri}' not found on server '${serverName}'`
        };
      }

      // Here we would normally fetch the actual resource
      // For now, we'll simulate the response
      this.logger.log(`Fetching MCP resource: ${serverName}/${uri}`);
      
      return {
        success: true,
        result: {
          uri,
          serverName,
          resource: 'MCP resource fetched successfully (simulated)'
        }
      };
    } catch (error) {
      this.logger.error(`Error fetching MCP resource: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

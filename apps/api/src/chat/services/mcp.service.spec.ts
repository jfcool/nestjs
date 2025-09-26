import { Test, TestingModule } from '@nestjs/testing';
import { McpService } from './mcp.service';
import { McpClientService } from './mcp-client.service';
import { testHelpers } from '../../../test/setup';

describe('McpService', () => {
  let service: McpService;
  let mcpClientService: McpClientService;

  const mockMcpClientService = {
    startServer: jest.fn(),
    stopAllServers: jest.fn(),
    listTools: jest.fn(),
    listResources: jest.fn(),
    callTool: jest.fn(),
    isServerRunning: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        McpService,
        {
          provide: McpClientService,
          useValue: mockMcpClientService,
        },
      ],
    }).compile();

    service = module.get<McpService>(McpService);
    mcpClientService = module.get<McpClientService>(McpClientService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAvailableServers', () => {
    it('should return list of available MCP servers', () => {
      const servers = service.getAvailableServers();

      expect(Array.isArray(servers)).toBe(true);
      expect(servers.length).toBeGreaterThan(0);
      
      const documentRetrievalServer = servers.find(s => s.name === 'document-retrieval');
      expect(documentRetrievalServer).toBeDefined();
      expect(documentRetrievalServer?.tools.length).toBeGreaterThan(0);
    });
  });

  describe('getAllServersWithStatus', () => {
    it('should return servers with their status', () => {
      const servers = service.getAllServersWithStatus();

      expect(Array.isArray(servers)).toBe(true);
      expect(servers.length).toBeGreaterThan(0);
      
      servers.forEach(server => {
        expect(server).toHaveProperty('name');
        expect(server).toHaveProperty('disabled');
        expect(typeof server.disabled).toBe('boolean');
      });
    });
  });

  describe('executeTool', () => {
    it('should execute document-retrieval search tool', async () => {
      const axios = require('axios');
      axios.post.mockResolvedValue({
        data: { access_token: 'test-token' },
      });
      axios.get.mockResolvedValue({
        data: {
          success: true,
          data: [
            {
              documentId: 'doc-1',
              content: 'Test content',
              score: 0.8,
            },
          ],
          resultsCount: 1,
        },
      });

      const toolCall = {
        serverName: 'document-retrieval',
        toolName: 'search_documents',
        arguments: {
          query: 'test',
          limit: 5,
        },
      };

      const result = await service.executeTool(toolCall);

      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('query', 'test');
      expect(result.result).toHaveProperty('results');
      expect(Array.isArray(result.result.results)).toBe(true);
    });

    it('should execute document-retrieval stats tool', async () => {
      const mockAxios = require('axios');
      mockAxios.post.mockResolvedValue({
        data: { access_token: 'test-token' },
      });
      mockAxios.get.mockResolvedValue({
        data: {
          success: true,
          data: {
            totalDocuments: 10,
            totalChunks: 50,
            documentsWithEmbeddings: 8,
          },
        },
      });

      const toolCall = {
        serverName: 'document-retrieval',
        toolName: 'get_document_stats',
        arguments: {},
      };

      const result = await service.executeTool(toolCall);

      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('stats');
      expect(result.result.stats).toHaveProperty('totalDocuments', 10);
    });

    it('should execute embedding test tool', async () => {
      const mockAxios = require('axios');
      mockAxios.post.mockResolvedValue({
        data: { access_token: 'test-token' },
      });
      mockAxios.get.mockResolvedValue({
        data: {
          success: true,
          data: {
            connected: true,
            dimensions: 768,
          },
        },
      });

      const toolCall = {
        serverName: 'document-retrieval',
        toolName: 'test_embedding_service',
        arguments: {},
      };

      const result = await service.executeTool(toolCall);

      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('connected', true);
      expect(result.result).toHaveProperty('dimensions', 768);
    });

    it('should handle unknown server', async () => {
      const toolCall = {
        serverName: 'unknown-server',
        toolName: 'test-tool',
        arguments: {},
      };

      const result = await service.executeTool(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle unknown tool', async () => {
      const toolCall = {
        serverName: 'document-retrieval',
        toolName: 'unknown-tool',
        arguments: {},
      };

      const result = await service.executeTool(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle authentication failure', async () => {
      const mockAxios = require('axios');
      mockAxios.post.mockRejectedValue(new Error('Authentication failed'));

      const toolCall = {
        serverName: 'document-retrieval',
        toolName: 'search_documents',
        arguments: { query: 'test' },
      };

      const result = await service.executeTool(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication failed');
    });
  });

  describe('getAvailableTools', () => {
    it('should return tools for document-retrieval server', async () => {
      const tools = await service.getAvailableTools('document-retrieval');

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      const searchTool = tools.find(t => t.name === 'search_documents');
      expect(searchTool).toBeDefined();
      expect(searchTool?.description).toContain('search');
    });

    it('should return empty array for unknown server', async () => {
      const tools = await service.getAvailableTools('unknown-server');

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(0);
    });
  });

  describe('reloadConfiguration', () => {
    it('should reload MCP configuration successfully', async () => {
      mockMcpClientService.stopAllServers.mockResolvedValue(undefined);
      mockMcpClientService.startServer.mockResolvedValue(true);
      mockMcpClientService.listTools.mockResolvedValue([]);
      mockMcpClientService.listResources.mockResolvedValue([]);

      await expect(service.reloadConfiguration()).resolves.not.toThrow();

      expect(mockMcpClientService.stopAllServers).toHaveBeenCalled();
    });
  });

  describe('SAP Tool Execution', () => {
    it('should execute SAP search services tool', async () => {
      const toolCall = {
        serverName: 'everest-SAP-system',
        toolName: 'search-sap-services',
        arguments: {
          query: 'business partner',
          category: 'business-partner',
        },
      };

      const result = await service.executeTool(toolCall);

      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('services');
      expect(Array.isArray(result.result.services)).toBe(true);
      expect(result.result).toHaveProperty('query', 'business partner');
    });

    it('should execute SAP discover entities tool', async () => {
      const toolCall = {
        serverName: 'everest-SAP-system',
        toolName: 'discover-service-entities',
        arguments: {
          serviceId: 'API_BUSINESS_PARTNER',
        },
      };

      const result = await service.executeTool(toolCall);

      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('serviceId', 'API_BUSINESS_PARTNER');
      expect(result.result).toHaveProperty('entities');
      expect(Array.isArray(result.result.entities)).toBe(true);
    });

    it('should execute SAP get entity schema tool', async () => {
      const toolCall = {
        serverName: 'everest-SAP-system',
        toolName: 'get-entity-schema',
        arguments: {
          serviceId: 'API_BUSINESS_PARTNER',
          entityName: 'BusinessPartner',
        },
      };

      const result = await service.executeTool(toolCall);

      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('serviceId', 'API_BUSINESS_PARTNER');
      expect(result.result).toHaveProperty('entityName', 'BusinessPartner');
      expect(result.result).toHaveProperty('schema');
    });
  });

  describe('getResource', () => {
    it('should get SAP services resource', async () => {
      const result = await service.getResource('everest-SAP-system', 'sap://services');

      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('uri', 'sap://services');
      expect(result.result).toHaveProperty('serverName', 'everest-SAP-system');
    });

    it('should handle unknown resource', async () => {
      const result = await service.getResource('everest-SAP-system', 'unknown://resource');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
});

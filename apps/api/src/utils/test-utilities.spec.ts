import { testHelpers } from '../../test/setup';

describe('Test Utilities', () => {
  describe('UUID Validation', () => {
    it('should validate correct UUIDs', () => {
      const validUUIDs = [
        '123e4567-e89b-12d3-a456-426614174000',
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
      ];

      validUUIDs.forEach(uuid => {
        expect(testHelpers.isValidUUID(uuid)).toBe(true);
      });
    });

    it('should reject invalid UUIDs', () => {
      const invalidUUIDs = [
        'not-a-uuid',
        '123e4567-e89b-12d3-a456',
        '123e4567-e89b-12d3-a456-426614174000-extra',
        '',
        null,
        undefined,
        '123e4567-e89b-12d3-g456-426614174000', // invalid character
      ];

      invalidUUIDs.forEach(uuid => {
        expect(testHelpers.isValidUUID(uuid as any)).toBe(false);
      });
    });
  });

  describe('Date Validation', () => {
    it('should validate correct dates', () => {
      const validDates = [
        new Date(),
        new Date('2023-01-01'),
        new Date('2023-12-31T23:59:59.999Z'),
        '2023-01-01',
        '2023-12-31T23:59:59.999Z',
        1640995200000, // timestamp
      ];

      validDates.forEach(date => {
        expect(testHelpers.isValidDate(date)).toBe(true);
      });
    });

    it('should reject invalid dates', () => {
      const invalidDates = [
        'not-a-date',
        'invalid-date-string',
        '',
        null,
        undefined,
        NaN,
        new Date('invalid'),
      ];

      invalidDates.forEach(date => {
        expect(testHelpers.isValidDate(date)).toBe(false);
      });
    });
  });

  describe('Mock Response Creation', () => {
    it('should create mock axios response with default status', () => {
      const data = { message: 'success', id: 123 };
      const response = testHelpers.createMockAxiosResponse(data);

      expect(response).toHaveProperty('data', data);
      expect(response).toHaveProperty('status', 200);
      expect(response).toHaveProperty('statusText', 'OK');
      expect(response).toHaveProperty('headers', {});
      expect(response).toHaveProperty('config', {});
    });

    it('should create mock axios response with custom status', () => {
      const data = { error: 'Not found' };
      const response = testHelpers.createMockAxiosResponse(data, 404);

      expect(response).toHaveProperty('data', data);
      expect(response).toHaveProperty('status', 404);
      expect(response).toHaveProperty('statusText', 'OK');
    });

    it('should handle null and undefined data', () => {
      const nullResponse = testHelpers.createMockAxiosResponse(null);
      const undefinedResponse = testHelpers.createMockAxiosResponse(undefined);

      expect(nullResponse.data).toBeNull();
      expect(undefinedResponse.data).toBeUndefined();
      expect(nullResponse.status).toBe(200);
      expect(undefinedResponse.status).toBe(200);
    });
  });

  describe('Global Test Utils', () => {
    it('should have global testUtils available', () => {
      expect(global.testUtils).toBeDefined();
      expect(typeof global.testUtils.createMockResponse).toBe('function');
      expect(typeof global.testUtils.createMockRequest).toBe('function');
    });

    it('should create mock HTTP response', () => {
      const data = { test: 'data' };
      const response = global.testUtils.createMockResponse(data, 201);

      expect(response).toHaveProperty('data', data);
      expect(response).toHaveProperty('status', 201);
      expect(response).toHaveProperty('statusText', 'OK');
    });

    it('should create mock HTTP request', () => {
      const body = { username: 'test', password: 'test' };
      const headers = { 'Content-Type': 'application/json' };
      const request = global.testUtils.createMockRequest(body, headers);

      expect(request).toHaveProperty('body', body);
      expect(request).toHaveProperty('headers', headers);
      expect(request).toHaveProperty('query', {});
      expect(request).toHaveProperty('params', {});
    });
  });
});

describe('Integration Test Helpers', () => {
  describe('API Response Validation', () => {
    it('should validate successful API response structure', () => {
      const response = {
        success: true,
        data: { id: '123e4567-e89b-12d3-a456-426614174000' },
        message: 'Operation successful',
      };

      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('message');
      expect(testHelpers.isValidUUID(response.data.id)).toBe(true);
    });

    it('should validate error API response structure', () => {
      const response = {
        success: false,
        error: 'Something went wrong',
        statusCode: 400,
      };

      expect(response).toHaveProperty('success', false);
      expect(response).toHaveProperty('error');
      expect(response).toHaveProperty('statusCode');
      expect(typeof response.error).toBe('string');
      expect(typeof response.statusCode).toBe('number');
    });
  });

  describe('Document Search Response Validation', () => {
    it('should validate document search response', () => {
      const searchResponse = {
        success: true,
        data: [
          {
            documentId: '123e4567-e89b-12d3-a456-426614174000',
            chunkId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            content: 'Test content',
            score: 0.85,
            documentTitle: 'Test Document',
          },
        ],
        resultsCount: 1,
        query: 'test query',
      };

      expect(searchResponse).toHaveProperty('success', true);
      expect(searchResponse).toHaveProperty('data');
      expect(searchResponse).toHaveProperty('resultsCount', 1);
      expect(searchResponse).toHaveProperty('query');
      expect(Array.isArray(searchResponse.data)).toBe(true);

      const firstResult = searchResponse.data[0];
      expect(testHelpers.isValidUUID(firstResult.documentId)).toBe(true);
      expect(testHelpers.isValidUUID(firstResult.chunkId)).toBe(true);
      expect(typeof firstResult.score).toBe('number');
      expect(firstResult.score).toBeGreaterThan(0);
      expect(firstResult.score).toBeLessThanOrEqual(1);
    });
  });

  describe('MCP Tool Response Validation', () => {
    it('should validate MCP tool execution response', () => {
      const mcpResponse = {
        success: true,
        result: {
          query: 'test query',
          results: [
            {
              documentId: '123e4567-e89b-12d3-a456-426614174000',
              content: 'Test content',
              score: 0.75,
            },
          ],
          resultsCount: 1,
          message: 'Found 1 documents matching "test query"',
        },
      };

      expect(mcpResponse).toHaveProperty('success', true);
      expect(mcpResponse).toHaveProperty('result');
      expect(mcpResponse.result).toHaveProperty('query');
      expect(mcpResponse.result).toHaveProperty('results');
      expect(mcpResponse.result).toHaveProperty('resultsCount');
      expect(Array.isArray(mcpResponse.result.results)).toBe(true);

      if (mcpResponse.result.results.length > 0) {
        const firstResult = mcpResponse.result.results[0];
        expect(testHelpers.isValidUUID(firstResult.documentId)).toBe(true);
        expect(typeof firstResult.score).toBe('number');
      }
    });
  });

  describe('Database Statistics Validation', () => {
    it('should validate document statistics response', () => {
      const statsResponse = {
        success: true,
        data: {
          totalDocuments: 10,
          totalChunks: 50,
          totalSize: 1024000,
          documentsWithEmbeddings: 8,
          averageChunkSize: 20480,
          totalSearchableChunks: 45,
        },
      };

      expect(statsResponse).toHaveProperty('success', true);
      expect(statsResponse).toHaveProperty('data');
      
      const stats = statsResponse.data;
      expect(typeof stats.totalDocuments).toBe('number');
      expect(typeof stats.totalChunks).toBe('number');
      expect(typeof stats.totalSize).toBe('number');
      expect(typeof stats.documentsWithEmbeddings).toBe('number');
      expect(typeof stats.averageChunkSize).toBe('number');
      expect(typeof stats.totalSearchableChunks).toBe('number');

      expect(stats.totalDocuments).toBeGreaterThanOrEqual(0);
      expect(stats.totalChunks).toBeGreaterThanOrEqual(0);
      expect(stats.documentsWithEmbeddings).toBeLessThanOrEqual(stats.totalDocuments);
      expect(stats.totalSearchableChunks).toBeLessThanOrEqual(stats.totalChunks);
    });
  });

  describe('Authentication Response Validation', () => {
    it('should validate login response', () => {
      const loginResponse = {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      expect(loginResponse).toHaveProperty('access_token');
      expect(loginResponse).toHaveProperty('token_type', 'Bearer');
      expect(loginResponse).toHaveProperty('expires_in');
      expect(typeof loginResponse.access_token).toBe('string');
      expect(loginResponse.access_token.length).toBeGreaterThan(0);
      expect(typeof loginResponse.expires_in).toBe('number');
      expect(loginResponse.expires_in).toBeGreaterThan(0);
    });
  });
});

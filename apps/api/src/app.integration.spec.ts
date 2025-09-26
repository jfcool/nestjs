import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './app.module';
import { testHelpers } from '../test/setup';

describe('API Integration Tests', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication', () => {
    it('should login with admin credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'admin',
          password: 'admin',
        })
        .expect(201);

      expect(response.body).toHaveProperty('access_token');
      expect(typeof response.body.access_token).toBe('string');
      
      authToken = response.body.access_token;
    });

    it('should reject invalid credentials', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'invalid',
          password: 'invalid',
        })
        .expect(401);
    });
  });

  describe('Embedding Service', () => {
    it('should test embedding service connection', async () => {
      const response = await request(app.getHttpServer())
        .get('/documents/embedding/test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('connected', true);
      expect(response.body.data).toHaveProperty('dimensions', 768);
    });
  });

  describe('Document Management', () => {
    let documentId: string;

    it('should index a test document', async () => {
      const response = await request(app.getHttpServer())
        .post('/documents/index')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          path: './documents/test-embedding.txt',
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body.data).toHaveProperty('id');
      
      documentId = response.body.data.id;
      expect(testHelpers.isValidUUID(documentId)).toBe(true);
    });

    it('should get document statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/documents/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('totalDocuments');
      expect(response.body.data).toHaveProperty('totalChunks');
      expect(response.body.data).toHaveProperty('documentsWithEmbeddings');
      expect(typeof response.body.data.totalDocuments).toBe('number');
    });

    it('should search documents', async () => {
      // Wait for embedding generation
      await new Promise(resolve => setTimeout(resolve, 3000));

      const response = await request(app.getHttpServer())
        .get('/documents/search')
        .query({
          query: 'test',
          limit: 5,
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('resultsCount');
      expect(Array.isArray(response.body.data)).toBe(true);
      
      if (response.body.resultsCount > 0) {
        const firstResult = response.body.data[0];
        expect(firstResult).toHaveProperty('documentId');
        expect(firstResult).toHaveProperty('content');
        expect(firstResult).toHaveProperty('score');
        expect(testHelpers.isValidUUID(firstResult.documentId)).toBe(true);
        expect(typeof firstResult.score).toBe('number');
      }
    });
  });

  describe('MCP Integration', () => {
    it('should list available MCP servers', async () => {
      const response = await request(app.getHttpServer())
        .get('/chat/mcp/servers')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      const documentRetrievalServer = response.body.find(
        server => server.name === 'document-retrieval'
      );
      expect(documentRetrievalServer).toBeDefined();
      expect(documentRetrievalServer.disabled).toBe(false);
      expect(Array.isArray(documentRetrievalServer.tools)).toBe(true);
      expect(documentRetrievalServer.tools.length).toBeGreaterThan(0);
    });

    it('should execute document search via MCP', async () => {
      const response = await request(app.getHttpServer())
        .post('/chat/mcp/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          serverName: 'document-retrieval',
          toolName: 'search_documents',
          arguments: {
            query: 'test',
            limit: 5,
          },
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.result).toHaveProperty('query', 'test');
      expect(response.body.result).toHaveProperty('results');
      expect(response.body.result).toHaveProperty('resultsCount');
      expect(Array.isArray(response.body.result.results)).toBe(true);
    });
  });

  describe('Health Checks', () => {
    it('should return application health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/')
        .expect(200);

      expect(response.text).toContain('Hello World');
    });
  });
});

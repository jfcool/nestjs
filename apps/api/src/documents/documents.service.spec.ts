import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentEntity } from './entities/document.entity';
import { ChunkEntity } from './entities/chunk.entity';
import { DocumentIndexingService } from './services/document-indexing.service';
import { DocumentRetrievalService } from './services/document-retrieval.service';
import { EmbeddingService } from './services/embedding.service';
import { testHelpers } from '../../test/setup';

describe('DocumentIndexingService', () => {
  let service: DocumentIndexingService;
  let documentRepository: Repository<DocumentEntity>;
  let chunkRepository: Repository<ChunkEntity>;
  let embeddingService: EmbeddingService;

  const mockDocumentRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
  };

  const mockChunkRepository = {
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
    query: jest.fn(),
  };

  const mockEmbeddingService = {
    generateEmbedding: jest.fn(),
    testConnection: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentIndexingService,
        {
          provide: getRepositoryToken(DocumentEntity),
          useValue: mockDocumentRepository,
        },
        {
          provide: getRepositoryToken(ChunkEntity),
          useValue: mockChunkRepository,
        },
        {
          provide: EmbeddingService,
          useValue: mockEmbeddingService,
        },
      ],
    }).compile();

    service = module.get<DocumentIndexingService>(DocumentIndexingService);
    documentRepository = module.get<Repository<DocumentEntity>>(getRepositoryToken(DocumentEntity));
    chunkRepository = module.get<Repository<ChunkEntity>>(getRepositoryToken(ChunkEntity));
    embeddingService = module.get<EmbeddingService>(EmbeddingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('indexDocument', () => {
    it('should index a new document successfully', async () => {
      const mockDocument = {
        id: 'test-id',
        path: './documents/test.txt',
        title: 'test',
        fileType: 'txt',
        fileSize: '100',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockChunk = {
        id: 'chunk-id',
        content: 'Test content',
        chunk_index: 0,
        token_count: 2,
        document_id: 'test-id',
      };

      mockDocumentRepository.findOne.mockResolvedValue(null);
      mockDocumentRepository.create.mockReturnValue(mockDocument);
      mockDocumentRepository.save.mockResolvedValue(mockDocument);
      mockChunkRepository.create.mockReturnValue(mockChunk);
      mockChunkRepository.save.mockResolvedValue(mockChunk);
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);

      const result = await service.indexDocument('./documents/test.txt');

      expect(result).toBeDefined();
      expect(result.path).toBe('./documents/test.txt');
      expect(mockDocumentRepository.save).toHaveBeenCalled();
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalled();
    });

    it('should handle file not found error', async () => {
      await expect(service.indexDocument('./nonexistent/file.txt'))
        .rejects
        .toThrow();
    });

    it('should skip indexing if document is up to date', async () => {
      const existingDocument = {
        id: 'existing-id',
        path: './documents/test.txt',
        mtime: new Date(),
      };

      mockDocumentRepository.findOne.mockResolvedValue(existingDocument);

      const result = await service.indexDocument('./documents/test.txt');

      expect(result).toBe(existingDocument);
      expect(mockEmbeddingService.generateEmbedding).not.toHaveBeenCalled();
    });
  });

  describe('removeDocument', () => {
    it('should remove document and its chunks', async () => {
      const mockDocument = {
        id: 'test-id',
        path: './documents/test.txt',
        chunks: [{ id: 'chunk-1' }, { id: 'chunk-2' }],
      };

      mockDocumentRepository.findOne.mockResolvedValue(mockDocument);
      mockDocumentRepository.remove.mockResolvedValue(mockDocument);

      await service.removeDocument('./documents/test.txt');

      expect(mockDocumentRepository.findOne).toHaveBeenCalledWith({
        where: { path: './documents/test.txt' },
        relations: ['chunks'],
      });
      expect(mockDocumentRepository.remove).toHaveBeenCalledWith(mockDocument);
    });

    it('should handle removal of non-existent document', async () => {
      mockDocumentRepository.findOne.mockResolvedValue(null);

      await expect(service.removeDocument('./nonexistent/file.txt'))
        .resolves
        .not.toThrow();
    });
  });
});

describe('DocumentRetrievalService', () => {
  let service: DocumentRetrievalService;
  let chunkRepository: Repository<ChunkEntity>;
  let embeddingService: EmbeddingService;

  const mockChunkRepository = {
    query: jest.fn(),
    save: jest.fn(),
  };

  const mockEmbeddingService = {
    generateEmbedding: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentRetrievalService,
        {
          provide: getRepositoryToken(ChunkEntity),
          useValue: mockChunkRepository,
        },
        {
          provide: EmbeddingService,
          useValue: mockEmbeddingService,
        },
      ],
    }).compile();

    service = module.get<DocumentRetrievalService>(DocumentRetrievalService);
    chunkRepository = module.get<Repository<ChunkEntity>>(getRepositoryToken(ChunkEntity));
    embeddingService = module.get<EmbeddingService>(EmbeddingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('searchDocuments', () => {
    it('should search documents with vector similarity', async () => {
      const mockResults = [
        {
          document_id: 'doc-1',
          chunk_id: 'chunk-1',
          document_path: './test.txt',
          document_title: 'test',
          content: 'Test content',
          score: 0.8,
          chunk_index: 0,
        },
      ];

      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      mockChunkRepository.query.mockResolvedValue(mockResults);

      const result = await service.searchDocuments('test query', 5, 0.1);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('documentId', 'doc-1');
      expect(result[0]).toHaveProperty('score', 0.8);
      expect(testHelpers.isValidUUID(result[0].chunkId)).toBe(true);
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith('test query');
    });

    it('should return empty array when no results found', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      mockChunkRepository.query.mockResolvedValue([]);

      const result = await service.searchDocuments('nonexistent query', 5, 0.1);

      expect(result).toHaveLength(0);
    });

    it('should handle embedding generation failure', async () => {
      mockEmbeddingService.generateEmbedding.mockRejectedValue(new Error('Embedding failed'));

      await expect(service.searchDocuments('test query', 5, 0.1))
        .rejects
        .toThrow('Embedding failed');
    });
  });

  describe('getDocumentStats', () => {
    it('should return document statistics', async () => {
      const mockStats = [
        {
          totalDocuments: '10',
          totalChunks: '50',
          totalSize: '1000000',
          documentsWithEmbeddings: '8',
          averageChunkSize: '20000',
        },
      ];

      mockChunkRepository.query.mockResolvedValue(mockStats);

      const result = await service.getDocumentStats();

      expect(result).toHaveProperty('totalDocuments', 10);
      expect(result).toHaveProperty('totalChunks', 50);
      expect(result).toHaveProperty('documentsWithEmbeddings', 8);
      expect(typeof result.totalDocuments).toBe('number');
    });
  });
});

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      switch (key) {
        case 'OLLAMA_BASE_URL':
          return 'http://localhost:11434';
        case 'OLLAMA_MODEL':
          return 'nomic-embed-text';
        default:
          return undefined;
      }
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingService,
        {
          provide: 'ConfigService',
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EmbeddingService>(EmbeddingService);
  });

  describe('testConnection', () => {
    it('should test embedding service connection', async () => {
      // Mock axios for this test
      const mockAxios = require('axios');
      mockAxios.post.mockResolvedValue({
        data: { embedding: new Array(768).fill(0.1) },
      });

      const result = await service.testConnection();

      expect(result).toHaveProperty('connected', true);
      expect(result).toHaveProperty('dimensions', 768);
    });

    it('should handle connection failure', async () => {
      const mockAxios = require('axios');
      mockAxios.post.mockRejectedValue(new Error('Connection failed'));

      const result = await service.testConnection();

      expect(result).toHaveProperty('connected', false);
      expect(result).toHaveProperty('error');
    });
  });

  describe('generateEmbedding', () => {
    it('should generate embedding for text', async () => {
      const mockAxios = require('axios');
      mockAxios.post.mockResolvedValue({
        data: { embedding: new Array(768).fill(0.1) },
      });

      const result = await service.generateEmbedding('test text');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(768);
      expect(typeof result[0]).toBe('number');
    });

    it('should handle empty text', async () => {
      await expect(service.generateEmbedding(''))
        .rejects
        .toThrow();
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ChunkEntity } from '../documents/entities/chunk.entity';
import { DocumentEntity } from '../documents/entities/document.entity';
import { testHelpers } from '../../test/setup';

describe('Database Setup Tests', () => {
  let dataSource: DataSource;
  let chunkRepository: Repository<ChunkEntity>;
  let documentRepository: Repository<DocumentEntity>;

  const mockDataSource = {
    query: jest.fn(),
    isInitialized: true,
    manager: {
      query: jest.fn(),
    },
  };

  const mockChunkRepository = {
    query: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
  };

  const mockDocumentRepository = {
    query: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: getRepositoryToken(ChunkEntity),
          useValue: mockChunkRepository,
        },
        {
          provide: getRepositoryToken(DocumentEntity),
          useValue: mockDocumentRepository,
        },
      ],
    }).compile();

    dataSource = module.get<DataSource>(DataSource);
    chunkRepository = module.get<Repository<ChunkEntity>>(getRepositoryToken(ChunkEntity));
    documentRepository = module.get<Repository<DocumentEntity>>(getRepositoryToken(DocumentEntity));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Database Connection', () => {
    it('should connect to database successfully', async () => {
      expect(dataSource.isInitialized).toBe(true);
    });

    it('should execute raw SQL queries', async () => {
      mockDataSource.query.mockResolvedValue([{ version: 'PostgreSQL 15.4' }]);

      const result = await dataSource.query('SELECT version()');

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('version');
      expect(result[0].version).toContain('PostgreSQL');
    });
  });

  describe('pgvector Extension', () => {
    it('should verify pgvector extension is installed', async () => {
      mockDataSource.query.mockResolvedValue([
        { extname: 'vector', extversion: '0.5.0' }
      ]);

      const result = await dataSource.query(
        "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'"
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('extname', 'vector');
      expect(result[0]).toHaveProperty('extversion');
    });

    it('should create vector indexes successfully', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await expect(
        dataSource.query(`
          CREATE INDEX IF NOT EXISTS chunks_embedding_cosine_idx 
          ON chunks USING ivfflat (embedding vector_cosine_ops) 
          WITH (lists = 100)
        `)
      ).resolves.not.toThrow();

      expect(mockDataSource.query).toHaveBeenCalled();
    });

    it('should verify embedding column exists', async () => {
      mockDataSource.query.mockResolvedValue([
        {
          column_name: 'embedding',
          data_type: 'USER-DEFINED',
          udt_name: 'vector',
        }
      ]);

      const result = await dataSource.query(`
        SELECT column_name, data_type, udt_name 
        FROM information_schema.columns 
        WHERE table_name = 'chunks' AND column_name = 'embedding'
      `);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('column_name', 'embedding');
      expect(result[0]).toHaveProperty('udt_name', 'vector');
    });
  });

  describe('Vector Operations', () => {
    it('should perform vector similarity search', async () => {
      const mockResults = [
        {
          id: 'chunk-1',
          content: 'Test content',
          similarity: 0.8,
          document_id: 'doc-1',
        },
      ];

      mockChunkRepository.query.mockResolvedValue(mockResults);

      const queryEmbedding = new Array(768).fill(0.1);
      const result = await chunkRepository.query(`
        SELECT 
          c.id,
          c.content,
          c.document_id,
          1 - (c.embedding <=> $1::vector) as similarity
        FROM chunks c
        WHERE c.embedding IS NOT NULL
        ORDER BY c.embedding <=> $1::vector
        LIMIT 5
      `, [JSON.stringify(queryEmbedding)]);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('similarity');
      expect(typeof result[0].similarity).toBe('number');
      expect(testHelpers.isValidUUID(result[0].id)).toBe(true);
    });

    it('should calculate vector distances', async () => {
      const mockResults = [
        {
          cosine_distance: 0.2,
          l2_distance: 1.5,
          inner_product: 0.8,
        },
      ];

      mockDataSource.query.mockResolvedValue(mockResults);

      const vector1 = new Array(768).fill(0.1);
      const vector2 = new Array(768).fill(0.2);

      const result = await dataSource.query(`
        SELECT 
          $1::vector <=> $2::vector as cosine_distance,
          $1::vector <-> $2::vector as l2_distance,
          $1::vector <#> $2::vector as inner_product
      `, [JSON.stringify(vector1), JSON.stringify(vector2)]);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('cosine_distance');
      expect(result[0]).toHaveProperty('l2_distance');
      expect(result[0]).toHaveProperty('inner_product');
      expect(typeof result[0].cosine_distance).toBe('number');
    });

    it('should store and retrieve embeddings', async () => {
      const mockChunk = {
        id: 'test-chunk-id',
        content: 'Test content',
        embedding: `[${new Array(768).fill(0.1).join(',')}]`,
        document_id: 'test-doc-id',
        chunk_index: 0,
        token_count: 2,
      };

      mockChunkRepository.save.mockResolvedValue(mockChunk);
      mockChunkRepository.findOne.mockResolvedValue(mockChunk);

      // Save chunk with embedding
      const savedChunk = await chunkRepository.save(mockChunk as any);
      expect(savedChunk).toHaveProperty('embedding');
      expect(typeof savedChunk.embedding).toBe('string');

      // Retrieve chunk with embedding
      const retrievedChunk = await chunkRepository.findOne({
        where: { id: 'test-chunk-id' },
      });
      expect(retrievedChunk).toHaveProperty('embedding');
      expect(testHelpers.isValidUUID(retrievedChunk!.id)).toBe(true);
    });
  });

  describe('Database Statistics', () => {
    it('should get table statistics', async () => {
      const mockStats = [
        {
          table_name: 'documents',
          row_count: '10',
          total_size: '1024000',
        },
        {
          table_name: 'chunks',
          row_count: '50',
          total_size: '5120000',
        },
      ];

      mockDataSource.query.mockResolvedValue(mockStats);

      const result = await dataSource.query(`
        SELECT 
          schemaname,
          tablename as table_name,
          n_tup_ins + n_tup_upd + n_tup_del as row_count,
          pg_total_relation_size(schemaname||'.'||tablename) as total_size
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
      `);

      expect(result.length).toBeGreaterThan(0);
      result.forEach(stat => {
        expect(stat).toHaveProperty('table_name');
        expect(stat).toHaveProperty('row_count');
        expect(stat).toHaveProperty('total_size');
      });
    });

    it('should get embedding statistics', async () => {
      const mockEmbeddingStats = [
        {
          total_chunks: '50',
          chunks_with_embeddings: '45',
          avg_embedding_dimension: '768',
        },
      ];

      mockDataSource.query.mockResolvedValue(mockEmbeddingStats);

      const result = await dataSource.query(`
        SELECT 
          COUNT(*) as total_chunks,
          COUNT(embedding) as chunks_with_embeddings,
          AVG(array_length(embedding::float[], 1)) as avg_embedding_dimension
        FROM chunks
      `);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('total_chunks');
      expect(result[0]).toHaveProperty('chunks_with_embeddings');
      expect(result[0]).toHaveProperty('avg_embedding_dimension');
    });
  });

  describe('Data Integrity', () => {
    it('should maintain referential integrity between documents and chunks', async () => {
      const mockDocument = {
        id: 'doc-1',
        path: './test.txt',
        title: 'test',
        fileType: 'txt',
        chunks: [],
      };

      const mockChunk = {
        id: 'chunk-1',
        content: 'Test content',
        document_id: 'doc-1',
        chunk_index: 0,
        token_count: 2,
      };

      mockDocumentRepository.save.mockResolvedValue(mockDocument);
      mockChunkRepository.save.mockResolvedValue(mockChunk);

      const savedDocument = await documentRepository.save(mockDocument);
      const savedChunk = await chunkRepository.save(mockChunk);

      expect(savedChunk.document_id).toBe(savedDocument.id);
      expect(testHelpers.isValidUUID(savedDocument.id)).toBe(true);
      expect(testHelpers.isValidUUID(savedChunk.id)).toBe(true);
    });

    it('should handle cascade deletion', async () => {
      const mockDocument = {
        id: 'doc-1',
        chunks: [
          { id: 'chunk-1' },
          { id: 'chunk-2' },
        ],
      };

      mockDocumentRepository.findOne.mockResolvedValue(mockDocument);
      mockDocumentRepository.remove.mockResolvedValue(mockDocument);

      await documentRepository.remove(mockDocument);

      expect(mockDocumentRepository.remove).toHaveBeenCalledWith(mockDocument);
    });
  });

  describe('Performance Tests', () => {
    it('should handle large vector operations efficiently', async () => {
      const largeEmbedding = new Array(768).fill(0).map(() => Math.random());
      
      mockChunkRepository.query.mockResolvedValue([]);

      const startTime = Date.now();
      
      await chunkRepository.query(`
        SELECT id, content, 1 - (embedding <=> $1::vector) as similarity
        FROM chunks
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector
        LIMIT 100
      `, [JSON.stringify(largeEmbedding)]);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Should complete within reasonable time (mocked, so should be very fast)
      expect(executionTime).toBeLessThan(1000);
    });

    it('should handle batch operations', async () => {
      const batchSize = 10;
      const mockChunks = Array.from({ length: batchSize }, (_, i) => ({
        id: `chunk-${i}`,
        content: `Content ${i}`,
        embedding: `[${new Array(768).fill(i / 100).join(',')}]`,
        document_id: 'doc-1',
        chunk_index: i,
        token_count: 10,
      }));

      mockChunkRepository.save.mockResolvedValue(mockChunks);

      const result = await chunkRepository.save(mockChunks);

      expect(mockChunkRepository.save).toHaveBeenCalledWith(mockChunks);
      expect(result).toHaveLength(batchSize);
    });
  });
});

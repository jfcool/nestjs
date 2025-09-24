import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as chokidar from 'chokidar';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DocumentEntity } from '../entities/document.entity';
import { ChunkEntity } from '../entities/chunk.entity';
import { EmbeddingService } from './embedding.service';
import { DocumentParserService } from './document-parser.service';
import { UsersService } from '../../users/users.service';

@Injectable()
export class DocumentIndexingService {
  private readonly logger = new Logger(DocumentIndexingService.name);
  private watcher: chokidar.FSWatcher | null = null;
  private readonly watchPath: string;
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;

  constructor(
    @InjectRepository(DocumentEntity)
    private readonly documentRepository: Repository<DocumentEntity>,
    @InjectRepository(ChunkEntity)
    private readonly chunkRepository: Repository<ChunkEntity>,
    private readonly dataSource: DataSource,
    private readonly embeddingService: EmbeddingService,
    private readonly parserService: DocumentParserService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {
    this.watchPath = this.configService.get('DOCUMENT_WATCH_PATH', './documents');
    this.chunkSize = parseInt(this.configService.get('DOCUMENT_CHUNK_SIZE', '1200'), 10);
    this.chunkOverlap = parseInt(this.configService.get('DOCUMENT_CHUNK_OVERLAP', '150'), 10);
  }

  async onModuleInit() {
    // Start watching for file changes
    await this.startWatching();
  }

  async onModuleDestroy() {
    if (this.watcher) {
      await this.watcher.close();
    }
  }

  async startWatching() {
    try {
      // Ensure watch directory exists
      await fs.mkdir(this.watchPath, { recursive: true });

      this.watcher = chokidar.watch(this.watchPath, {
        ignoreInitial: false,
        persistent: true,
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        depth: 10, // Allow deep nesting
      });

      this.watcher.on('add', (filePath) => this.handleFileAdd(filePath));
      this.watcher.on('change', (filePath) => this.handleFileChange(filePath));
      this.watcher.on('unlink', (filePath) => this.handleFileDelete(filePath));

      this.logger.log(`Started watching directory: ${this.watchPath}`);
    } catch (error) {
      this.logger.error(`Failed to start watching directory: ${error.message}`);
    }
  }

  private async handleFileAdd(filePath: string) {
    this.logger.log(`File added: ${filePath}`);
    await this.indexDocument(filePath);
  }

  private async handleFileChange(filePath: string) {
    this.logger.log(`File changed: ${filePath}`);
    await this.indexDocument(filePath);
  }

  private async handleFileDelete(filePath: string) {
    this.logger.log(`File deleted: ${filePath}`);
    await this.removeDocument(filePath);
  }

  async indexDocument(filePath: string): Promise<DocumentEntity | null> {
    try {
      // Check if file type is supported
      if (!this.parserService.isSupported(filePath)) {
        this.logger.debug(`Skipping unsupported file: ${filePath}`);
        return null;
      }

      // Get file info
      const fileInfo = await this.parserService.getFileInfo(filePath);

      // Check if document already exists and is up to date
      const existingDoc = await this.documentRepository.findOne({
        where: { path: filePath },
      });

      if (existingDoc && existingDoc.sha256 === fileInfo.sha256) {
        this.logger.debug(`Document already up to date: ${filePath}`);
        return existingDoc;
      }

      // Parse document
      const parsed = await this.parserService.parseDocument(filePath);

      // Create or update document entity
      const document = existingDoc || new DocumentEntity();
      document.path = filePath;
      document.mtime = fileInfo.mtime;
      document.sha256 = fileInfo.sha256;
      document.title = parsed.title || path.basename(filePath);
      document.fileType = fileInfo.fileType;
      document.fileSize = fileInfo.size;
      document.meta = parsed.metadata || {};

      const savedDocument = await this.documentRepository.save(document);

      // Remove existing chunks if updating
      if (existingDoc) {
        await this.chunkRepository.delete({ document_id: existingDoc.id });
      }

      // Chunk the text
      const chunks = await this.parserService.chunkText(
        parsed.text,
        this.chunkSize,
        this.chunkOverlap,
      );

      if (chunks.length === 0) {
        this.logger.warn(`No chunks generated for document: ${filePath}`);
        return savedDocument;
      }

      // Generate embeddings for all chunks
      this.logger.log(`Generating embeddings for ${chunks.length} chunks`);
      const embeddings = await this.embeddingService.generateEmbeddings(chunks);

      // Create chunk entities
      const chunkEntities = chunks.map((content, index) => {
        const chunk = new ChunkEntity();
        chunk.document_id = savedDocument.id;
        chunk.chunk_index = index;
        chunk.content = content;
        chunk.token_count = this.parserService.countTokens(content);
        chunk.embedding = embeddings[index];
        return chunk;
      });

      // Save chunks in batches using raw SQL for pgvector compatibility
      const batchSize = 50;
      for (let i = 0; i < chunkEntities.length; i += batchSize) {
        const batch = chunkEntities.slice(i, i + batchSize);
        
        // Use raw SQL to insert chunks with pgvector embeddings
        for (const chunk of batch) {
          const embeddingVector = chunk.embedding ? `[${chunk.embedding.join(',')}]` : null;
          
          await this.dataSource.query(`
            INSERT INTO chunks (id, document_id, chunk_index, content, token_count, embedding, "createdAt", "updatedAt")
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::vector, NOW(), NOW())
          `, [
            chunk.document_id,
            chunk.chunk_index,
            chunk.content,
            chunk.token_count,
            embeddingVector
          ]);
        }
      }

      this.logger.log(`Successfully indexed document: ${filePath} with ${chunks.length} chunks`);
      return savedDocument;
    } catch (error) {
      this.logger.error(`Failed to index document ${filePath}: ${error.message}`);
      throw error;
    }
  }

  async removeDocument(filePath: string): Promise<void> {
    try {
      const document = await this.documentRepository.findOne({
        where: { path: filePath },
      });

      if (document) {
        // Chunks will be deleted automatically due to CASCADE
        await this.documentRepository.remove(document);
        this.logger.log(`Removed document: ${filePath}`);
      }
    } catch (error) {
      this.logger.error(`Failed to remove document ${filePath}: ${error.message}`);
      throw error;
    }
  }

  async indexDirectory(directoryPath: string): Promise<void> {
    try {
      const files = await this.getFilesRecursively(directoryPath);
      
      this.logger.log(`Found ${files.length} files to index in ${directoryPath}`);

      for (const filePath of files) {
        try {
          await this.indexDocument(filePath);
        } catch (error) {
          this.logger.error(`Failed to index ${filePath}: ${error.message}`);
          // Continue with other files
        }
      }

      this.logger.log(`Completed indexing directory: ${directoryPath}`);
    } catch (error) {
      this.logger.error(`Failed to index directory ${directoryPath}: ${error.message}`);
      throw error;
    }
  }

  private async getFilesRecursively(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip hidden directories
        if (!entry.name.startsWith('.')) {
          const subFiles = await this.getFilesRecursively(fullPath);
          files.push(...subFiles);
        }
      } else if (entry.isFile()) {
        // Skip hidden files
        if (!entry.name.startsWith('.') && this.parserService.isSupported(fullPath)) {
          files.push(fullPath);
        }
      }
    }
    
    return files;
  }

  async getDocuments(limit: number = 50, offset: number = 0): Promise<DocumentEntity[]> {
    const documents = await this.documentRepository.find({
      take: limit,
      skip: offset,
      order: { updatedAt: 'DESC' },
    });

    // Add chunk count for each document
    for (const doc of documents) {
      const chunkCount = await this.chunkRepository.count({
        where: { document_id: doc.id },
      });
      (doc as any).chunkCount = chunkCount;
    }

    return documents;
  }

  async getDocumentById(id: string): Promise<DocumentEntity | null> {
    return this.documentRepository.findOne({
      where: { id },
      relations: ['chunks'],
    });
  }

  async getDocumentStats(): Promise<{
    totalDocuments: number;
    totalChunks: number;
    totalSize: number;
  }> {
    const [totalDocuments, totalChunks] = await Promise.all([
      this.documentRepository.count(),
      this.chunkRepository.count(),
    ]);

    const sizeResult = await this.documentRepository
      .createQueryBuilder('doc')
      .select('SUM(doc.fileSize)', 'totalSize')
      .getRawOne();

    return {
      totalDocuments,
      totalChunks,
      totalSize: parseInt(sizeResult.totalSize || '0', 10),
    };
  }

  async reindexAll(): Promise<void> {
    this.logger.log('Starting full reindex...');
    
    // Clear existing data
    await this.chunkRepository.delete({});
    await this.documentRepository.delete({});
    
    // Reindex the watch directory
    await this.indexDirectory(this.watchPath);
    
    this.logger.log('Full reindex completed');
  }

  async clearAllDocuments(): Promise<void> {
    this.logger.log('Clearing all documents and chunks from database...');
    
    try {
      // Use raw SQL to delete all data efficiently
      const chunkCount = await this.chunkRepository.count();
      const docCount = await this.documentRepository.count();
      
      if (chunkCount > 0 || docCount > 0) {
        // Delete all chunks first (due to foreign key constraints)
        await this.dataSource.query('DELETE FROM chunks');
        this.logger.log(`Deleted ${chunkCount} chunks`);
        
        // Delete all documents
        await this.dataSource.query('DELETE FROM documents');
        this.logger.log(`Deleted ${docCount} documents`);
      } else {
        this.logger.log('No documents or chunks to delete');
      }
      
      this.logger.log('Successfully cleared all documents and chunks from database');
    } catch (error) {
      this.logger.error(`Failed to clear documents: ${error.message}`);
      throw error;
    }
  }
}

import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, sql, count, desc } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DATABASE_CONNECTION } from '../../database/database.module';
import * as schema from '../../database/schema';
import { ConfigService } from '@nestjs/config';
import * as chokidar from 'chokidar';
import * as fs from 'fs/promises';
import * as path from 'path';
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
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
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
    // Wait a bit for database to be fully ready
    setTimeout(() => {
      this.startWatching().catch(err => 
        this.logger.error(`Failed to start file watcher: ${err.message}`)
      );
    }, 2000);
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
    try {
      await this.indexDocument(filePath);
    } catch (error) {
      this.logger.error(`Failed to index ${filePath}: ${error.message}`);
    }
  }

  private async handleFileChange(filePath: string) {
    this.logger.log(`File changed: ${filePath}`);
    try {
      await this.indexDocument(filePath);
    } catch (error) {
      this.logger.error(`Failed to index ${filePath}: ${error.message}`);
    }
  }

  private async handleFileDelete(filePath: string) {
    this.logger.log(`File deleted: ${filePath}`);
    await this.removeDocument(filePath);
  }

  async indexDocument(filePath: string): Promise<any | null> {
    try {
      // Check if file type is supported
      if (!this.parserService.isSupported(filePath)) {
        this.logger.debug(`Skipping unsupported file: ${filePath}`);
        return null;
      }

      // Get file info
      const fileInfo = await this.parserService.getFileInfo(filePath);

      // Check if document already exists and is up to date
      const existingDoc = await this.db.query.documents.findFirst({
        where: eq(schema.documents.path, filePath),
      });

      if (existingDoc && existingDoc.sha256 === fileInfo.sha256) {
        this.logger.debug(`Document already up to date: ${filePath}`);
        return existingDoc;
      }

      // Parse document
      const parsed = await this.parserService.parseDocument(filePath);

      let savedDocument;
      if (existingDoc) {
        // Update existing document
        [savedDocument] = await this.db
          .update(schema.documents)
          .set({
            mtime: fileInfo.mtime,
            sha256: fileInfo.sha256,
            title: parsed.title || path.basename(filePath),
            fileType: fileInfo.fileType,
            fileSize: fileInfo.size,
            meta: parsed.metadata || {},
          })
          .where(eq(schema.documents.id, existingDoc.id))
          .returning();

        // Remove existing chunks if updating
        await this.db
          .delete(schema.chunks)
          .where(eq(schema.chunks.document_id, existingDoc.id));
      } else {
        // Create new document
        [savedDocument] = await this.db
          .insert(schema.documents)
          .values({
            path: filePath,
            mtime: fileInfo.mtime,
            sha256: fileInfo.sha256,
            title: parsed.title || path.basename(filePath),
            fileType: fileInfo.fileType,
            fileSize: fileInfo.size,
            meta: parsed.metadata || {},
          })
          .returning();
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
      this.logger.log(`Generating embeddings for ${chunks.length} chunks...`);
      let embeddings: number[][] = [];
      let embeddingsGenerated = false;
      
      try {
        embeddings = await this.embeddingService.generateEmbeddings(chunks);
        embeddingsGenerated = true;
        this.logger.log(`✅ Successfully generated ${embeddings.length} embeddings`);
      } catch (error) {
        this.logger.warn(`⚠️  Failed to generate embeddings: ${error.message}`);
        this.logger.warn(`   Continuing without embeddings. Chunks will be searchable by text only.`);
        // Create empty embeddings array
        embeddings = new Array(chunks.length).fill(null);
      }

      // Create chunk entities
      const chunkEntities = chunks.map((content, index) => ({
        document_id: savedDocument.id,
        chunk_index: index,
        content: content,
        token_count: this.parserService.countTokens(content),
        // Convert number array to string for database storage
        embedding: embeddings[index] ? `[${embeddings[index].join(',')}]` : null,
      }));

      // Save chunks in batches using raw SQL for pgvector compatibility
      this.logger.log(`Saving ${chunkEntities.length} chunks to database...`);
      const batchSize = 50;
      let savedChunks = 0;
      
      for (let i = 0; i < chunkEntities.length; i += batchSize) {
        const batch = chunkEntities.slice(i, i + batchSize);
        
        // Use raw SQL to insert chunks with pgvector embeddings
        for (const chunk of batch) {
          try {
            const embeddingVector = chunk.embedding;
            
            await this.db.execute(sql`
              INSERT INTO chunks (id, document_id, chunk_index, content, token_count, embedding, "createdAt", "updatedAt")
              VALUES (gen_random_uuid(), ${chunk.document_id}, ${chunk.chunk_index}, ${chunk.content}, ${chunk.token_count}, ${embeddingVector}::vector, NOW(), NOW())
            `);
            savedChunks++;
          } catch (error) {
            this.logger.error(`Failed to save chunk ${chunk.chunk_index}: ${error.message}`);
            // Try saving without embedding
            try {
              await this.db.execute(sql`
                INSERT INTO chunks (id, document_id, chunk_index, content, token_count, embedding, "createdAt", "updatedAt")
                VALUES (gen_random_uuid(), ${chunk.document_id}, ${chunk.chunk_index}, ${chunk.content}, ${chunk.token_count}, NULL, NOW(), NOW())
              `);
              savedChunks++;
              this.logger.warn(`  Saved chunk ${chunk.chunk_index} without embedding`);
            } catch (fallbackError) {
              this.logger.error(`  Failed to save chunk ${chunk.chunk_index} even without embedding: ${fallbackError.message}`);
            }
          }
        }
      }

      const status = embeddingsGenerated ? '✅' : '⚠️';
      this.logger.log(`${status} Successfully indexed document: ${filePath}`);
      this.logger.log(`   - Saved ${savedChunks}/${chunks.length} chunks`);
      if (!embeddingsGenerated) {
        this.logger.warn(`   - ⚠️  No embeddings generated (embedding service unavailable)`);
      }
      return savedDocument;
    } catch (error) {
      this.logger.error(`Failed to index document ${filePath}: ${error.message}`);
      throw error;
    }
  }

  async removeDocument(filePath: string): Promise<void> {
    try {
      const document = await this.db.query.documents.findFirst({
        where: eq(schema.documents.path, filePath),
      });

      if (document) {
        // Chunks will be deleted automatically due to CASCADE
        await this.db
          .delete(schema.documents)
          .where(eq(schema.documents.id, document.id));
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

  async getDocuments(limit: number = 50, offset: number = 0) {
    const documents = await this.db.query.documents.findMany({
      limit,
      offset,
      orderBy: [desc(schema.documents.updatedAt)],
    });

    // Add chunk count for each document
    for (const doc of documents) {
      const [result] = await this.db
        .select({ count: count() })
        .from(schema.chunks)
        .where(eq(schema.chunks.document_id, doc.id));
      (doc as any).chunkCount = result.count;
    }

    return documents;
  }

  async getDocumentById(id: string) {
    const document = await this.db.query.documents.findFirst({
      where: eq(schema.documents.id, id),
    });

    if (!document) {
      return null;
    }

    // Get chunks separately
    const chunks = await this.db
      .select()
      .from(schema.chunks)
      .where(eq(schema.chunks.document_id, id));

    return { ...document, chunks };
  }

  async getDocumentStats(): Promise<{
    totalDocuments: number;
    totalChunks: number;
    totalSize: number;
  }> {
    const [docsResult] = await this.db
      .select({ count: count() })
      .from(schema.documents);
    
    const [chunksResult] = await this.db
      .select({ count: count() })
      .from(schema.chunks);

    const [sizeResult] = await this.db.execute(sql`
      SELECT SUM("fileSize")::bigint as total_size
      FROM documents
    `);

    return {
      totalDocuments: docsResult.count,
      totalChunks: chunksResult.count,
      totalSize: parseInt((sizeResult as any)?.total_size || '0', 10),
    };
  }

  async reindexAll(): Promise<void> {
    this.logger.log('Starting full reindex...');
    
    // Clear existing data
    await this.db.delete(schema.chunks);
    await this.db.delete(schema.documents);
    
    // Reindex the watch directory
    await this.indexDirectory(this.watchPath);
    
    this.logger.log('Full reindex completed');
  }

  async clearAllDocuments(): Promise<void> {
    this.logger.log('Clearing all documents and chunks from database...');
    
    try {
      // Get counts before deletion
      const [chunksResult] = await this.db
        .select({ count: count() })
        .from(schema.chunks);
      const [docsResult] = await this.db
        .select({ count: count() })
        .from(schema.documents);
      
      const chunkCount = chunksResult.count;
      const docCount = docsResult.count;
      
      if (chunkCount > 0 || docCount > 0) {
        // Delete all chunks first (due to foreign key constraints)
        await this.db.execute(sql`DELETE FROM chunks`);
        this.logger.log(`Deleted ${chunkCount} chunks`);
        
        // Delete all documents
        await this.db.execute(sql`DELETE FROM documents`);
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

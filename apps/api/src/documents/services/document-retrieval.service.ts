import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ChunkEntity } from '../entities/chunk.entity';
import { DocumentEntity } from '../entities/document.entity';
import { EmbeddingService } from './embedding.service';
import { DocumentClassificationService } from './document-classification.service';
import { SearchDocumentsDto, SearchResultDto } from '../dto/search-documents.dto';

@Injectable()
export class DocumentRetrievalService {
  private readonly logger = new Logger(DocumentRetrievalService.name);

  constructor(
    @InjectRepository(ChunkEntity)
    private readonly chunkRepository: Repository<ChunkEntity>,
    @InjectRepository(DocumentEntity)
    private readonly documentRepository: Repository<DocumentEntity>,
    private readonly dataSource: DataSource,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async searchDocuments(searchDto: SearchDocumentsDto): Promise<SearchResultDto[]> {
    try {
      this.logger.log(`Searching for: "${searchDto.query}"`);
      
      // Generate embedding for the query
      const queryEmbedding = await this.embeddingService.generateEmbedding(searchDto.query);
      this.logger.log(`Generated query embedding with ${queryEmbedding.length} dimensions`);

      // Use optimized threshold for OpenAI embeddings (they have higher similarity scores)
      const threshold = searchDto.threshold || 0.3;
      this.logger.log(`Using similarity threshold: ${threshold}`);

      // Perform enhanced search with importance-based ranking and diversity
      const results = await this.performEnhancedVectorSearch(
        searchDto.query,
        queryEmbedding,
        searchDto.limit || 10,
        threshold,
      );

      this.logger.log(`Found ${results.length} results with enhanced ranking`);
      return results;
    } catch (error) {
      this.logger.error(`Failed to search documents: ${error.message}`);
      throw error;
    }
  }

  /**
   * Enhanced vector search that addresses the chat analysis issues:
   * 1. Importance-based ranking (aviation docs get higher priority)
   * 2. Document diversity (prevents telecom invoice dominance)
   * 3. Access tracking (popular docs get slight boost)
   * 4. Category balancing (ensures different document types appear)
   */
  private async performEnhancedVectorSearch(
    query: string,
    queryEmbedding: number[],
    limit: number,
    threshold: number,
  ): Promise<SearchResultDto[]> {
    const queryVector = `[${queryEmbedding.join(',')}]`;
    
    this.logger.log(`Performing enhanced vector search with importance ranking`);
    
    // Get more results initially to allow for diversity filtering
    const initialLimit = Math.min(limit * 3, 50);
    
    const results = await this.dataSource.query(`
      SELECT 
        c.id as chunk_id,
        c.document_id,
        c.chunk_index,
        c.content,
        c.token_count,
        d.path as document_path,
        d.title as document_title,
        d."documentType",
        d.category,
        d.importance,
        d."accessCount",
        d."lastAccessedAt",
        1 - (c.embedding <=> $1::vector) as base_similarity,
        -- Enhanced scoring formula
        (1 - (c.embedding <=> $1::vector)) * 
        COALESCE(d.importance, 1.0) * 
        (1 + LEAST(COALESCE(d."accessCount", 0) * 0.01, 0.2)) as enhanced_score
      FROM chunks c
      JOIN documents d ON c.document_id = d.id
      WHERE c.embedding IS NOT NULL
        AND 1 - (c.embedding <=> $1::vector) >= $2
      ORDER BY enhanced_score DESC
      LIMIT $3
    `, [queryVector, threshold, initialLimit]);

    this.logger.log(`Found ${results.length} initial results, applying diversity filtering`);

    // Apply diversity filtering to prevent document type dominance
    const diverseResults = this.applyDiversityFiltering(results, limit);
    
    // Update access tracking for returned documents
    await this.updateAccessTracking(diverseResults.map(r => r.document_id));

    return diverseResults.map(row => ({
      documentId: row.document_id,
      chunkId: row.chunk_id,
      documentPath: row.document_path,
      documentTitle: row.document_title || row.document_path,
      content: row.content,
      score: parseFloat(row.enhanced_score),
      chunkIndex: row.chunk_index,
    }));
  }

  /**
   * Apply diversity filtering to prevent one document type from dominating results
   * This addresses the chat issue where telecom invoices overwhelmed aviation certificates
   */
  private applyDiversityFiltering(results: any[], limit: number): any[] {
    const categoryCount = new Map<string, number>();
    const typeCount = new Map<string, number>();
    const diverseResults: any[] = [];
    
    // Sort by enhanced score first
    results.sort((a, b) => parseFloat(b.enhanced_score) - parseFloat(a.enhanced_score));
    
    for (const result of results) {
      if (diverseResults.length >= limit) break;
      
      const category = result.category || 'general';
      const docType = result.documentType || 'document';
      
      const categoryCountValue = categoryCount.get(category) || 0;
      const typeCountValue = typeCount.get(docType) || 0;
      
      // Allow high-importance documents (like aviation) to bypass some diversity limits
      const isHighImportance = parseFloat(result.importance || 1.0) > 1.5;
      const maxCategoryCount = isHighImportance ? Math.ceil(limit * 0.6) : Math.ceil(limit * 0.4);
      const maxTypeCount = isHighImportance ? Math.ceil(limit * 0.5) : Math.ceil(limit * 0.3);
      
      // Apply diversity constraints
      if (categoryCountValue < maxCategoryCount && typeCountValue < maxTypeCount) {
        diverseResults.push(result);
        categoryCount.set(category, categoryCountValue + 1);
        typeCount.set(docType, typeCountValue + 1);
      } else if (isHighImportance && diverseResults.length < limit) {
        // Always include high-importance documents if we have space
        diverseResults.push(result);
        categoryCount.set(category, categoryCountValue + 1);
        typeCount.set(docType, typeCountValue + 1);
      }
    }
    
    this.logger.log(`Applied diversity filtering: ${results.length} -> ${diverseResults.length} results`);
    this.logger.log(`Category distribution: ${JSON.stringify(Object.fromEntries(categoryCount))}`);
    
    return diverseResults;
  }

  /**
   * Update access tracking for documents to improve future search ranking
   */
  private async updateAccessTracking(documentIds: string[]): Promise<void> {
    if (documentIds.length === 0) return;
    
    try {
      await this.dataSource.query(`
        UPDATE documents 
        SET "accessCount" = "accessCount" + 1, 
            "lastAccessedAt" = NOW()
        WHERE id = ANY($1)
      `, [documentIds]);
      
      this.logger.log(`Updated access tracking for ${documentIds.length} documents`);
    } catch (error) {
      this.logger.warn(`Failed to update access tracking: ${error.message}`);
    }
  }

  private async performVectorSearch(
    queryEmbedding: number[],
    limit: number,
    threshold: number,
  ): Promise<SearchResultDto[]> {
    // Using pgvector SQL for optimal performance - NO FALLBACK!
    const queryVector = `[${queryEmbedding.join(',')}]`;
    
    this.logger.log(`Performing native pgvector search with threshold ${threshold}`);
    
    const results = await this.dataSource.query(`
      SELECT 
        c.id as chunk_id,
        c.document_id,
        c.chunk_index,
        c.content,
        c.token_count,
        d.path as document_path,
        d.title as document_title,
        1 - (c.embedding <=> $1::vector) as similarity
      FROM chunks c
      JOIN documents d ON c.document_id = d.id
      WHERE c.embedding IS NOT NULL
        AND 1 - (c.embedding <=> $1::vector) >= $2
      ORDER BY c.embedding <=> $1::vector
      LIMIT $3
    `, [queryVector, threshold, limit]);

    this.logger.log(`Found ${results.length} results above threshold ${threshold} using native pgvector`);

    return results.map(row => ({
      documentId: row.document_id,
      chunkId: row.chunk_id,
      documentPath: row.document_path,
      documentTitle: row.document_title || row.document_path,
      content: row.content,
      score: parseFloat(row.similarity),
      chunkIndex: row.chunk_index,
    }));
  }


  async getRelevantContext(
    query: string,
    maxChunks: number = 5,
    threshold: number = 0.7,
  ): Promise<{
    context: string;
    sources: Array<{
      documentPath: string;
      documentTitle: string;
      chunkIndex: number;
      score: number;
    }>;
  }> {
    const searchResults = await this.searchDocuments({
      query,
      limit: maxChunks,
      threshold,
    });

    const context = searchResults
      .map((result, index) => `[${index + 1}] ${result.content}`)
      .join('\n\n');

    const sources = searchResults.map((result) => ({
      documentPath: result.documentPath,
      documentTitle: result.documentTitle,
      chunkIndex: result.chunkIndex,
      score: result.score,
    }));

    return { context, sources };
  }

  async findSimilarChunks(chunkId: string, limit: number = 5): Promise<SearchResultDto[]> {
    const chunk = await this.chunkRepository.findOne({
      where: { id: chunkId },
      relations: ['document'],
    });

    if (!chunk || !chunk.embedding) {
      return [];
    }

    return this.performVectorSearch(chunk.embedding, limit, 0.5);
  }

  async getDocumentContext(documentId: string): Promise<{
    document: DocumentEntity;
    chunks: ChunkEntity[];
  }> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
      relations: ['chunks'],
    });

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Sort chunks by index
    const chunks = document.chunks.sort((a, b) => a.chunk_index - b.chunk_index);

    return { document, chunks };
  }

  async searchWithinDocument(
    documentId: string,
    query: string,
    limit: number = 5,
  ): Promise<SearchResultDto[]> {
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);
    const queryVector = `[${queryEmbedding.join(',')}]`;

    this.logger.log(`Searching within document ${documentId} using native pgvector`);

    const results = await this.dataSource.query(`
      SELECT 
        c.id as chunk_id,
        c.document_id,
        c.chunk_index,
        c.content,
        c.token_count,
        d.path as document_path,
        d.title as document_title,
        1 - (c.embedding <=> $1::vector) as similarity
      FROM chunks c
      JOIN documents d ON c.document_id = d.id
      WHERE c.document_id = $2
        AND c.embedding IS NOT NULL
      ORDER BY c.embedding <=> $1::vector
      LIMIT $3
    `, [queryVector, documentId, limit]);

    return results.map(row => ({
      documentId: row.document_id,
      chunkId: row.chunk_id,
      documentPath: row.document_path,
      documentTitle: row.document_title || row.document_path,
      content: row.content,
      score: parseFloat(row.similarity),
      chunkIndex: row.chunk_index,
    }));
  }

  async getChunksByDocument(documentId: string): Promise<ChunkEntity[]> {
    return this.chunkRepository.find({
      where: { document_id: documentId },
      order: { chunk_index: 'ASC' },
    });
  }

  async getSearchStats(): Promise<{
    totalSearchableChunks: number;
    averageChunkSize: number;
    documentsWithEmbeddings: number;
  }> {
    const [totalChunks, avgSizeResult, docsWithEmbeddings] = await Promise.all([
      this.chunkRepository.count(),
      this.chunkRepository
        .createQueryBuilder('chunk')
        .select('AVG(chunk.token_count)', 'avgSize')
        .getRawOne(),
      this.documentRepository
        .createQueryBuilder('doc')
        .innerJoin('doc.chunks', 'chunk')
        .where('chunk.embedding IS NOT NULL')
        .getCount(),
    ]);

    return {
      totalSearchableChunks: totalChunks,
      averageChunkSize: Math.round(parseFloat(avgSizeResult.avgSize || '0')),
      documentsWithEmbeddings: docsWithEmbeddings,
    };
  }
}

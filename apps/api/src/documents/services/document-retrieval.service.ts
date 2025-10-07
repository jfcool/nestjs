import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, sql, count, asc } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DATABASE_CONNECTION } from '../../database/database.module';
import * as schema from '../../database/schema';
import { EmbeddingService } from './embedding.service';
import { SearchDocumentsDto, SearchResultDto } from '../dto/search-documents.dto';

@Injectable()
export class DocumentRetrievalService {
  private readonly logger = new Logger(DocumentRetrievalService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async searchDocuments(searchDto: SearchDocumentsDto): Promise<SearchResultDto[]> {
    try {
      this.logger.log(`Searching for: "${searchDto.query}"`);
      
      const limit = searchDto.limit || 10;
      const threshold = searchDto.threshold || 0.7;
      
      // HYBRID SEARCH: Keyword (exact matches) + Vector (semantic)
      this.logger.log(`Using HYBRID SEARCH (Keyword + Vector) with threshold: ${threshold}`);
      
      // 1. Keyword search for exact word matches (e.g., names like "Brandhan", "Seeböck")
      const keywordResults = await this.performKeywordSearch(
        searchDto.query,
        limit * 2, // Get more candidates
      );
      
      this.logger.log(`Keyword search found ${keywordResults.length} exact matches`);
      
      // 2. Vector search for semantic similarity
      let vectorResults: SearchResultDto[] = [];
      try {
        const queryEmbedding = await this.embeddingService.generateEmbedding(searchDto.query);
        this.logger.log(`Generated query embedding with ${queryEmbedding.length} dimensions`);

        vectorResults = await this.performVectorSearch(
          queryEmbedding,
          limit * 2,
          threshold,
        );
        
        this.logger.log(`Vector search found ${vectorResults.length} semantic matches above threshold ${threshold}`);
      } catch (error) {
        this.logger.warn(`Vector search failed: ${error.message}, using keyword results only`);
      }

      // 3. Combine results: Keyword matches get HIGHEST priority
      const combinedResults = this.combineSearchResults(
        keywordResults,
        vectorResults,
        limit,
      );

      this.logger.log(`Returning ${combinedResults.length} combined results (${keywordResults.length} keyword + ${vectorResults.length} vector)`);
      return combinedResults;
    } catch (error) {
      this.logger.error(`Failed to search documents: ${error.message}`);
      throw error;
    }
  }

  /**
   * Perform keyword-based search with FUZZY MATCHING
   * Finds exact matches AND similar spellings (e.g., "Brandhahn" finds "Brandhan")
   */
  private async performKeywordSearch(
    query: string,
    limit: number,
  ): Promise<SearchResultDto[]> {
    const originalQuery = query.trim();
    
    // Sanitize query for PostgreSQL text search
    const sanitizedQuery = query
      .replace(/[^\w\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0)
      .join(' & ');

    if (!sanitizedQuery) {
      return [];
    }

    this.logger.log(`Performing ADVANCED fuzzy search with word-level Trigram similarity for: "${originalQuery}"`);

    // Advanced Combined search: Full-text + ILIKE + Word-level Trigram similarity
    const results = await this.db.execute(sql`
      SELECT DISTINCT ON (c.id)
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
        GREATEST(
          -- Full-text search score (exact words)
          COALESCE(
            ts_rank(to_tsvector('german', c.content), to_tsquery('german', ${sanitizedQuery})),
            0
          ) * 1.2,
          -- Fuzzy pattern matching score (typos, similar spellings)
          CASE 
            WHEN c.content ILIKE ${'%' + originalQuery + '%'} THEN 0.9
            ELSE 0
          END,
          -- Word-level Trigram similarity (compares query to WORDS in text, not whole text)
          COALESCE(
            word_similarity(${originalQuery}, c.content),
            0
          ) * 0.8
        ) as keyword_score
      FROM chunks c
      JOIN documents d ON c.document_id = d.id
      WHERE 
        -- Exact full-text match
        to_tsvector('german', c.content) @@ to_tsquery('german', ${sanitizedQuery})
        OR
        -- Fuzzy pattern match (case-insensitive contains)
        c.content ILIKE ${'%' + originalQuery + '%'}
        OR
        -- Word-level Trigram match (handles typos in individual words)
        word_similarity(${originalQuery}, c.content) > 0.3
      ORDER BY c.id, keyword_score DESC
      LIMIT ${limit}
    `);

    this.logger.log(`Found ${results.length} matches (exact + fuzzy + word-trigram)`);

    return (results as any[]).map(row => ({
      documentId: row.document_id as string,
      chunkId: row.chunk_id as string,
      documentPath: row.document_path as string,
      documentTitle: (row.document_title || row.document_path) as string,
      content: row.content as string,
      score: parseFloat(row.keyword_score) + 1.0, // Boost keyword matches
      chunkIndex: row.chunk_index as number,
    }));
  }

  /**
   * Combine keyword and semantic search results with proper ranking
   */
  private combineSearchResults(
    keywordResults: SearchResultDto[],
    semanticResults: SearchResultDto[],
    limit: number,
  ): SearchResultDto[] {
    // Create a map to track unique chunks
    const resultsMap = new Map<string, SearchResultDto>();
    
    // Add keyword results first (they get priority)
    for (const result of keywordResults) {
      resultsMap.set(result.chunkId, {
        ...result,
        score: result.score * 1.5, // Boost keyword matches significantly
      });
    }
    
    // Add semantic results, but don't override keyword results
    for (const result of semanticResults) {
      if (!resultsMap.has(result.chunkId)) {
        resultsMap.set(result.chunkId, result);
      } else {
        // If already present from keyword search, slightly boost the score
        const existing = resultsMap.get(result.chunkId)!;
        existing.score = existing.score + (result.score * 0.2);
      }
    }
    
    // Sort by score and return top results
    const combined = Array.from(resultsMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    return combined;
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
    
    const results = await this.db.execute(sql`
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
        1 - (c.embedding <=> ${queryVector}::vector) as base_similarity,
        -- Enhanced scoring formula
        (1 - (c.embedding <=> ${queryVector}::vector)) * 
        COALESCE(d.importance, 1.0) * 
        (1 + LEAST(COALESCE(d."accessCount", 0) * 0.01, 0.2)) as enhanced_score
      FROM chunks c
      JOIN documents d ON c.document_id = d.id
      WHERE c.embedding IS NOT NULL
        AND 1 - (c.embedding <=> ${queryVector}::vector) >= ${threshold}
      ORDER BY enhanced_score DESC
      LIMIT ${initialLimit}
    `);

    this.logger.log(`Found ${results.length} initial results, applying diversity filtering`);

    // Apply diversity filtering to prevent document type dominance
    const diverseResults = this.applyDiversityFiltering(results, limit);
    
    // Update access tracking for returned documents
    await this.updateAccessTracking(diverseResults.map(r => r.document_id));

    return (diverseResults as any[]).map(row => ({
      documentId: row.document_id as string,
      chunkId: row.chunk_id as string,
      documentPath: row.document_path as string,
      documentTitle: (row.document_title || row.document_path) as string,
      content: row.content as string,
      score: parseFloat(row.enhanced_score),
      chunkIndex: row.chunk_index as number,
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
      await this.db.execute(sql`
        UPDATE documents 
        SET "accessCount" = "accessCount" + 1, 
            "lastAccessedAt" = NOW()
        WHERE id = ANY(${documentIds})
      `);
      
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
    
    const results = await this.db.execute(sql`
      SELECT 
        c.id as chunk_id,
        c.document_id,
        c.chunk_index,
        c.content,
        c.token_count,
        d.path as document_path,
        d.title as document_title,
        1 - (c.embedding <=> ${queryVector}::vector) as similarity
      FROM chunks c
      JOIN documents d ON c.document_id = d.id
      WHERE c.embedding IS NOT NULL
        AND 1 - (c.embedding <=> ${queryVector}::vector) >= ${threshold}
      ORDER BY c.embedding <=> ${queryVector}::vector
      LIMIT ${limit}
    `);

    this.logger.log(`Found ${results.length} results above threshold ${threshold} using native pgvector`);

    return (results as any[]).map(row => ({
      documentId: row.document_id as string,
      chunkId: row.chunk_id as string,
      documentPath: row.document_path as string,
      documentTitle: (row.document_title || row.document_path) as string,
      content: row.content as string,
      score: parseFloat(row.similarity),
      chunkIndex: row.chunk_index as number,
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
    const chunk = await this.db.query.chunks.findFirst({
      where: eq(schema.chunks.id, chunkId),
    });

    if (!chunk || !chunk.embedding) {
      return [];
    }

    // Parse the embedding - it's already a number array from Drizzle
    const embeddingArray = Array.isArray(chunk.embedding) ? chunk.embedding : [];
    return this.performVectorSearch(embeddingArray, limit, 0.5);
  }

  async getDocumentContext(documentId: string): Promise<{
    document: any;
    chunks: any[];
  }> {
    const document = await this.db.query.documents.findFirst({
      where: eq(schema.documents.id, documentId),
    });

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Get chunks separately and sort by index
    const chunks = await this.db
      .select()
      .from(schema.chunks)
      .where(eq(schema.chunks.document_id, documentId))
      .orderBy(asc(schema.chunks.chunk_index));

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

    const results = await this.db.execute(sql`
      SELECT 
        c.id as chunk_id,
        c.document_id,
        c.chunk_index,
        c.content,
        c.token_count,
        d.path as document_path,
        d.title as document_title,
        1 - (c.embedding <=> ${queryVector}::vector) as similarity
      FROM chunks c
      JOIN documents d ON c.document_id = d.id
      WHERE c.document_id = ${documentId}
        AND c.embedding IS NOT NULL
      ORDER BY c.embedding <=> ${queryVector}::vector
      LIMIT ${limit}
    `);

    return (results as any[]).map(row => ({
      documentId: row.document_id as string,
      chunkId: row.chunk_id as string,
      documentPath: row.document_path as string,
      documentTitle: (row.document_title || row.document_path) as string,
      content: row.content as string,
      score: parseFloat(row.similarity),
      chunkIndex: row.chunk_index as number,
    }));
  }

  async getChunksByDocument(documentId: string) {
    return await this.db
      .select()
      .from(schema.chunks)
      .where(eq(schema.chunks.document_id, documentId))
      .orderBy(asc(schema.chunks.chunk_index));
  }

  async getSearchStats(): Promise<{
    totalSearchableChunks: number;
    averageChunkSize: number;
    documentsWithEmbeddings: number;
  }> {
    // Total chunks count
    const [totalChunksResult] = await this.db
      .select({ count: count() })
      .from(schema.chunks);
    
    // Average chunk size
    const [avgSizeResult] = await this.db.execute(sql`
      SELECT AVG(token_count)::integer as avg_size
      FROM chunks
    `);
    
    // Documents with embeddings (distinct documents that have at least one chunk with embedding)
    const [docsWithEmbeddingsResult] = await this.db.execute(sql`
      SELECT COUNT(DISTINCT document_id) as count
      FROM chunks
      WHERE embedding IS NOT NULL
    `);

    return {
      totalSearchableChunks: totalChunksResult.count,
      averageChunkSize: (avgSizeResult as any)?.avg_size || 0,
      documentsWithEmbeddings: (docsWithEmbeddingsResult as any)?.count || 0,
    };
  }
}

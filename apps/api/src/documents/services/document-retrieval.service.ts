import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ChunkEntity } from '../entities/chunk.entity';
import { DocumentEntity } from '../entities/document.entity';
import { EmbeddingService } from './embedding.service';
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

      // Use a much lower threshold for fallback embeddings (0.01 instead of 0.7)
      const threshold = searchDto.threshold || 0.01;
      this.logger.log(`Using similarity threshold: ${threshold}`);

      // Perform vector similarity search using raw SQL
      // Note: We're using simple-array for now, but in production you'd want to use pgvector
      const results = await this.performVectorSearch(
        queryEmbedding,
        searchDto.limit || 10,
        threshold,
      );

      this.logger.log(`Found ${results.length} results above threshold ${threshold}`);
      return results;
    } catch (error) {
      this.logger.error(`Failed to search documents: ${error.message}`);
      throw error;
    }
  }

  private async performVectorSearch(
    queryEmbedding: number[],
    limit: number,
    threshold: number,
  ): Promise<SearchResultDto[]> {
    // For now, we'll use a simple approach since we're using simple-array
    // In production, you'd want to use pgvector's cosine similarity operators
    const chunks = await this.chunkRepository.find({
      relations: ['document'],
      take: 1000, // Get more chunks to calculate similarity
    });

    this.logger.log(`Found ${chunks.length} chunks in database to search through`);

    const results: Array<SearchResultDto & { similarity: number }> = [];

    for (const chunk of chunks) {
      if (!chunk.embedding || chunk.embedding.length === 0) {
        this.logger.log(`Chunk ${chunk.id} has no embedding, skipping`);
        continue;
      }

      // Calculate cosine similarity
      const similarity = this.calculateCosineSimilarity(queryEmbedding, chunk.embedding);
      this.logger.log(`Chunk ${chunk.id} similarity: ${similarity.toFixed(4)}`);

      if (similarity >= threshold) {
        results.push({
          documentId: chunk.document_id,
          chunkId: chunk.id,
          documentPath: chunk.document.path,
          documentTitle: chunk.document.title || chunk.document.path,
          content: chunk.content,
          score: similarity,
          chunkIndex: chunk.chunk_index,
          similarity,
        });
      }
    }

    this.logger.log(`${results.length} chunks passed similarity threshold of ${threshold}`);

    // Sort by similarity and return top results
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(({ similarity, ...result }) => result);
  }

  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
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

    const chunks = await this.chunkRepository.find({
      where: { document_id: documentId },
      relations: ['document'],
    });

    const results: Array<SearchResultDto & { similarity: number }> = [];

    for (const chunk of chunks) {
      if (!chunk.embedding || chunk.embedding.length === 0) {
        continue;
      }

      const similarity = this.calculateCosineSimilarity(queryEmbedding, chunk.embedding);

      results.push({
        documentId: chunk.document_id,
        chunkId: chunk.id,
        documentPath: chunk.document.path,
        documentTitle: chunk.document.title || chunk.document.path,
        content: chunk.content,
        score: similarity,
        chunkIndex: chunk.chunk_index,
        similarity,
      });
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(({ similarity, ...result }) => result);
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

import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Logger,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { DocumentIndexingService } from './services/document-indexing.service';
import { DocumentRetrievalService } from './services/document-retrieval.service';
import { EmbeddingService } from './services/embedding.service';
import { SearchDocumentsDto, SearchResultDto } from './dto/search-documents.dto';

@ApiTags('Documents')
@ApiBearerAuth()
@Controller('documents')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(
    private readonly indexingService: DocumentIndexingService,
    private readonly retrievalService: DocumentRetrievalService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  @Get()
  @RequirePermissions('documents')
  @ApiOperation({ summary: 'Get all documents' })
  @ApiResponse({ status: 200, description: 'Documents retrieved successfully' })
  async getDocuments(
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    try {
      const documents = await this.indexingService.getDocuments(limit, offset);
      return {
        success: true,
        data: documents,
        pagination: {
          limit,
          offset,
          total: documents.length,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get documents: ${error.message}`);
      throw new HttpException(
        'Failed to retrieve documents',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('stats')
  @RequirePermissions('documents')
  @ApiOperation({ summary: 'Get document statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getStats() {
    try {
      const [indexStats, searchStats] = await Promise.all([
        this.indexingService.getDocumentStats(),
        this.retrievalService.getSearchStats(),
      ]);

      return {
        success: true,
        data: {
          ...indexStats,
          ...searchStats,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get stats: ${error.message}`);
      throw new HttpException(
        'Failed to retrieve statistics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('search')
  @RequirePermissions('documents')
  @ApiOperation({ summary: 'Search documents using semantic search' })
  @ApiResponse({ 
    status: 200, 
    description: 'Search completed successfully',
    type: [SearchResultDto],
  })
  async searchDocuments(@Query() searchDto: SearchDocumentsDto) {
    try {
      const results = await this.retrievalService.searchDocuments(searchDto);
      
      return {
        success: true,
        data: results,
        query: searchDto.query,
        resultsCount: results.length,
      };
    } catch (error) {
      this.logger.error(`Failed to search documents: ${error.message}`);
      throw new HttpException(
        'Search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('context')
  @RequirePermissions('documents')
  @ApiOperation({ summary: 'Get relevant context for RAG' })
  @ApiResponse({ status: 200, description: 'Context retrieved successfully' })
  async getRelevantContext(
    @Query('query') query: string,
    @Query('maxChunks') maxChunks: number = 5,
    @Query('threshold') threshold: number = 0.7,
  ) {
    try {
      if (!query) {
        throw new HttpException('Query parameter is required', HttpStatus.BAD_REQUEST);
      }

      const context = await this.retrievalService.getRelevantContext(
        query,
        maxChunks,
        threshold,
      );

      return {
        success: true,
        data: context,
        query,
      };
    } catch (error) {
      this.logger.error(`Failed to get context: ${error.message}`);
      throw new HttpException(
        error.message || 'Failed to retrieve context',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('index')
  @RequirePermissions('documents')
  @ApiOperation({ summary: 'Index a specific file or directory from local filesystem' })
  @ApiResponse({ status: 200, description: 'Indexing completed successfully' })
  async indexPath(@Body() body: { path: string }) {
    try {
      if (!body.path) {
        throw new HttpException('Path is required', HttpStatus.BAD_REQUEST);
      }

      const fs = require('fs/promises');
      const path = require('path');
      
      // Use the exact path provided by the user
      let actualPath = body.path;
      
      // Check if the provided path exists
      const stats = await fs.stat(actualPath).catch(() => null);
      
      if (!stats) {
        throw new HttpException(`File or directory does not exist: ${body.path}`, HttpStatus.BAD_REQUEST);
      }

      if (stats.isDirectory()) {
        await this.indexingService.indexDirectory(actualPath);
        return {
          success: true,
          message: `Directory indexed successfully: ${actualPath}`,
        };
      } else {
        // Force reindexing by removing existing document first
        await this.indexingService.removeDocument(actualPath);
        const document = await this.indexingService.indexDocument(actualPath);
        return {
          success: true,
          message: `File indexed successfully: ${actualPath}`,
          data: document,
        };
      }
    } catch (error) {
      this.logger.error(`Failed to index path ${body.path}: ${error.message}`);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        `Indexing failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('embedding/test')
  @RequirePermissions('documents')
  @ApiOperation({ summary: 'Test embedding service connection' })
  @ApiResponse({ status: 200, description: 'Embedding service test completed' })
  async testEmbeddingService() {
    try {
      const isConnected = await this.embeddingService.testConnection();
      
      return {
        success: true,
        data: {
          connected: isConnected,
          dimensions: this.embeddingService.getDimensions(),
        },
      };
    } catch (error) {
      this.logger.error(`Embedding service test failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        data: {
          connected: false,
          dimensions: this.embeddingService.getDimensions(),
        },
      };
    }
  }

  @Delete('clear-all')
  @RequirePermissions('documents')
  @ApiOperation({ summary: 'Clear all documents and chunks from the database' })
  @ApiResponse({ status: 200, description: 'All documents and chunks cleared successfully' })
  async clearAllDocuments() {
    try {
      await this.indexingService.clearAllDocuments();
      
      return {
        success: true,
        message: 'All documents and chunks have been cleared from the database',
      };
    } catch (error) {
      this.logger.error(`Failed to clear all documents: ${error.message}`);
      throw new HttpException(
        `Failed to clear documents: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

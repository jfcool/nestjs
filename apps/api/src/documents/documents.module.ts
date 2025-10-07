import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DocumentsController } from './documents.controller';
import { DocumentIndexingService } from './services/document-indexing.service';
import { DocumentRetrievalService } from './services/document-retrieval.service';
import { DocumentParserService } from './services/document-parser.service';
import { EmbeddingService } from './services/embedding.service';
import { DocumentClassificationService } from './services/document-classification.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
  ],
  controllers: [DocumentsController],
  providers: [
    DocumentIndexingService,
    DocumentRetrievalService,
    DocumentParserService,
    EmbeddingService,
    DocumentClassificationService,
  ],
  exports: [
    DocumentIndexingService,
    DocumentRetrievalService,
    DocumentParserService,
    EmbeddingService,
    DocumentClassificationService,
  ],
})
export class DocumentsModule {}

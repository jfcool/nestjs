import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class SearchDocumentsDto {
  @ApiProperty({ description: 'Search query' })
  @IsString()
  query: string;

  @ApiPropertyOptional({ description: 'Number of results to return', minimum: 1, maximum: 50, default: 10 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Minimum similarity score', minimum: 0, maximum: 1, default: 0.1 })
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  @Max(1)
  threshold?: number = 0.1;
}

export class SearchResultDto {
  @ApiProperty({ description: 'Document ID' })
  documentId: string;

  @ApiProperty({ description: 'Chunk ID' })
  chunkId: string;

  @ApiProperty({ description: 'Document path' })
  documentPath: string;

  @ApiProperty({ description: 'Document title' })
  documentTitle: string;

  @ApiProperty({ description: 'Chunk content' })
  content: string;

  @ApiProperty({ description: 'Similarity score' })
  score: number;

  @ApiProperty({ description: 'Chunk index' })
  chunkIndex: number;
}

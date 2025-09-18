import { IsString, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateConversationDto {
  @ApiProperty({ description: 'Title of the conversation' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'AI model to use', default: 'gpt-4' })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ description: 'System prompt for the conversation' })
  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @ApiPropertyOptional({ description: 'List of MCP servers to use', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mcpServers?: string[];
}

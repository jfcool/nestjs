import { IsString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageRole } from '../entities/message.entity';

export class SendMessageDto {
  @ApiProperty({ description: 'Message content' })
  @IsString()
  content: string;

  @ApiProperty({ description: 'Message role', enum: MessageRole, default: MessageRole.USER })
  @IsEnum(MessageRole)
  role: MessageRole;

  @ApiPropertyOptional({ description: 'Conversation ID (if continuing existing conversation)' })
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @ApiPropertyOptional({ description: 'Whether to use MCP tools' })
  @IsOptional()
  useMcp?: boolean;
}

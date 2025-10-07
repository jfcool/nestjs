import { IsString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { messageRoleEnum } from '../../database/schema/enums';

export class SendMessageDto {
  @ApiProperty({ description: 'Message content' })
  @IsString()
  content: string;

  @ApiProperty({ description: 'Message role', enum: messageRoleEnum.enumValues, default: 'user' })
  @IsEnum(messageRoleEnum.enumValues)
  role: typeof messageRoleEnum.enumValues[number];

  @ApiPropertyOptional({ description: 'Conversation ID (if continuing existing conversation)' })
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @ApiPropertyOptional({ description: 'Whether to use MCP tools' })
  @IsOptional()
  useMcp?: boolean;
}

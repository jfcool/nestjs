import { IsString, IsOptional, IsNumber, IsBoolean, IsEnum } from 'class-validator';
import { connectionTypeEnum } from '../../database/schema/enums';

export class SapConnectionDto {
  @IsOptional()
  @IsString()
  connectionString?: string;

  @IsOptional()
  @IsEnum(connectionTypeEnum.enumValues)
  type?: typeof connectionTypeEnum.enumValues[number];

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsString()
  basePath?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsNumber()
  timeout?: number;

  @IsOptional()
  @IsBoolean()
  rejectUnauthorized?: boolean;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsString()
  cacheConnectionName?: string;
}

export class SapODataRequestDto {
  @IsString()
  servicePath: string;

  @IsOptional()
  connectionInfo?: SapConnectionDto;
}

export class SapODataResponse {
  content: string;
  contentType: string;
  url: string;
  isJson: boolean;
  parsedContent?: unknown;
  dataSource?: 'sap' | 'cache';
  cacheInfo?: {
    source: string;
    timestamp: string;
    servicePath: string;
  };
  sapInfo?: {
    timestamp: string;
    servicePath: string;
  };
}

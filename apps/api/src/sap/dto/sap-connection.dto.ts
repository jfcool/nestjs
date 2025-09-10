import { IsString, IsOptional, IsNumber, IsBoolean, IsEnum } from 'class-validator';
import { ConnectionType } from '../entities/sap-connection.entity';

export class SapConnectionDto {
  @IsOptional()
  @IsString()
  connectionString?: string;

  @IsOptional()
  @IsEnum(ConnectionType)
  type?: ConnectionType;

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

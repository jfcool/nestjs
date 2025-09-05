import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { SapConnectionDto, SapODataResponse } from './dto/sap-connection.dto';
import * as https from 'https';

// Custom Error Classes
export class SapHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly responseBody?: string
  ) {
    super(
      responseBody
        ? `SAP HTTP ${status}: ${statusText}\n\nDetails:\n${responseBody}`
        : `SAP HTTP ${status}: ${statusText}`
    );
    this.name = 'SapHttpError';
  }
}

export class SapFormatError extends Error {
  constructor(
    message: string,
    public readonly contentPreview?: string
  ) {
    super(message);
    this.name = 'SapFormatError';
  }
}

interface ResolvedSapClientOptions {
  readonly baseUrl: string;
  readonly username: string;
  readonly password: string;
  readonly timeout: number;
  readonly rejectUnauthorized: boolean;
  readonly userAgent: string;
}

@Injectable()
export class SapService {
  private readonly logger = new Logger(SapService.name);
  private readonly DEFAULT_TIMEOUT_MS = 30_000;
  private readonly DEFAULT_USER_AGENT = 'NestJS-SAP-OData-Client';
  private readonly PREVIEW_LENGTH = 400;
  private readonly ERROR_PREVIEW_LENGTH = 500;

  /**
   * Fetches OData service metadata (XML format)
   */
  async getMetadata(servicePath: string, connectionInfo: SapConnectionDto): Promise<SapODataResponse> {
    this.logger.debug(`[DEBUG] getMetadata called with servicePath: ${servicePath}`);
    this.logger.debug(`[DEBUG] connectionInfo: ${JSON.stringify({ ...connectionInfo, password: '***' })}`);
    
    const config = this.resolveConfiguration(connectionInfo);
    const fullUrl = this.buildServiceUrl(config.baseUrl, servicePath);

    this.logger.log(`[SAP] Fetching metadata from: ${fullUrl}`);
    this.logger.debug(`[DEBUG] Resolved config: ${JSON.stringify({ ...config, password: '***' })}`);

    try {
      const response = await this.makeHttpRequest(fullUrl, config, {
        Accept: 'application/xml',
      });

      this.validateXmlContent(response.content);

      this.logger.log(`[SAP] Metadata fetched successfully (${response.content.length} characters)`);
      this.logger.debug(`[DEBUG] Response content type: ${response.contentType}`);

      return {
        content: response.content,
        contentType: response.contentType || 'application/xml',
        url: fullUrl,
        isJson: false,
      };
    } catch (error) {
      this.logger.error(`[SAP ERROR] Failed to fetch metadata from ${fullUrl}`);
      this.logger.error(`[SAP ERROR] Error details: ${error.message}`);
      this.logger.debug(`[DEBUG] Full error stack: ${error.stack}`);
      throw new InternalServerErrorException(`Failed to fetch SAP metadata: ${error.message}`);
    }
  }

  /**
   * Fetches OData service data (JSON format preferred)
   */
  async getData(servicePath: string, connectionInfo: SapConnectionDto): Promise<SapODataResponse> {
    this.logger.debug(`[DEBUG] getData called with servicePath: ${servicePath}`);
    this.logger.debug(`[DEBUG] connectionInfo: ${JSON.stringify({ ...connectionInfo, password: '***' })}`);
    
    const config = this.resolveConfiguration(connectionInfo);
    const fullUrl = this.buildServiceUrl(config.baseUrl, servicePath);

    this.logger.log(`[SAP] Fetching data from: ${fullUrl}`);
    this.logger.debug(`[DEBUG] Resolved config: ${JSON.stringify({ ...config, password: '***' })}`);

    try {
      const response = await this.makeHttpRequest(fullUrl, config, {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      });

      const { content, isJson, parsedContent } = this.processResponseData(response.content);

      this.logger.log(`[SAP] Data fetched successfully (${content.length} characters)`);
      this.logger.debug(`[DEBUG] Response content type: ${response.contentType}, isJson: ${isJson}`);

      return {
        content,
        contentType: response.contentType || 'application/json',
        url: fullUrl,
        isJson,
        parsedContent,
      };
    } catch (error) {
      this.logger.error(`[SAP ERROR] Failed to fetch data from ${fullUrl}`);
      this.logger.error(`[SAP ERROR] Error details: ${error.message}`);
      this.logger.debug(`[DEBUG] Full error stack: ${error.stack}`);
      throw new InternalServerErrorException(`Failed to fetch SAP data: ${error.message}`);
    }
  }

  /**
   * Sets up SAP connection settings (simplified version for NestJS)
   */
  async setupConnectionSettings(connectionInfo: SapConnectionDto): Promise<Record<string, any>> {
    try {
      // Validate connection by making a test request to a common SAP service
      const testPath = '/sap/opu/odata/sap/API_BUSINESS_PARTNER/';
      await this.getData(testPath, connectionInfo);

      this.logger.log(`SAP connection configured successfully`);
      
      return {
        status: 'success',
        message: 'SAP connection configured successfully',
        baseUrl: connectionInfo.baseUrl || `https://${connectionInfo.basePath}`,
      };
    } catch (error) {
      this.logger.error(`Failed to setup SAP connection settings: ${error.message}`);
      throw new BadRequestException(`Failed to setup SAP connection: ${error.message}`);
    }
  }

  // Private helper methods

  private resolveConfiguration(options: SapConnectionDto): ResolvedSapClientOptions {
    if (!options.baseUrl && !options.basePath) {
      throw new BadRequestException('Either baseUrl or basePath is required');
    }
    if (!options.username) {
      throw new BadRequestException('Username is required');
    }
    if (!options.password) {
      throw new BadRequestException('Password is required');
    }

    let baseUrl = options.baseUrl;
    if (!baseUrl && options.basePath) {
      // Ensure proper URL format when constructing from basePath
      baseUrl = options.basePath.startsWith('http') 
        ? options.basePath 
        : `https://${options.basePath}`;
    }

    // Ensure baseUrl is defined at this point
    if (!baseUrl) {
      throw new BadRequestException('Unable to construct valid baseUrl from provided options');
    }

    return {
      baseUrl: baseUrl.replace(/\/$/, ''), // Remove trailing slash
      username: options.username,
      password: options.password,
      timeout: options.timeout ?? this.DEFAULT_TIMEOUT_MS,
      rejectUnauthorized: options.rejectUnauthorized ?? false,
      userAgent: options.userAgent ?? this.DEFAULT_USER_AGENT,
    };
  }

  private buildServiceUrl(baseUrl: string, servicePath: string): string {
    const normalizedPath = servicePath.startsWith('/') ? servicePath : `/${servicePath}`;
    return `${baseUrl}${normalizedPath}`;
  }

  private createBasicAuthCredentials(username: string, password: string): string {
    const credentials = `${username}:${password}`;
    return Buffer.from(credentials).toString('base64');
  }

  private async makeHttpRequest(
    url: string,
    config: ResolvedSapClientOptions,
    headers: Record<string, string> = {}
  ): Promise<{ content: string; contentType?: string }> {
    return new Promise((resolve, reject) => {
      const basicAuth = this.createBasicAuthCredentials(config.username, config.password);
      
      const requestHeaders = {
        Authorization: `Basic ${basicAuth}`,
        'User-Agent': config.userAgent,
        ...headers,
      };

      const agent = new https.Agent({
        rejectUnauthorized: config.rejectUnauthorized,
      });

      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port ? parseInt(urlObj.port) : 443,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: requestHeaders,
        agent,
        timeout: config.timeout,
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode !== 200) {
            const errorDetails = data.slice(0, this.ERROR_PREVIEW_LENGTH);
            reject(new SapHttpError(res.statusCode || 500, res.statusMessage || 'Unknown Error', errorDetails));
            return;
          }

          resolve({
            content: data,
            contentType: res.headers['content-type'],
          });
        });
      });

      req.on('error', (error) => {
        reject(new Error(`HTTP request failed: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout after ${config.timeout}ms`));
      });

      req.end();
    });
  }

  private validateXmlContent(content: string): void {
    if (this.isHtmlContent(content)) {
      const preview = content.slice(0, this.ERROR_PREVIEW_LENGTH);
      this.logger.error(`Received HTML error page instead of XML metadata: ${preview}`);
      throw new SapFormatError(
        'SAP returned an HTML error page instead of metadata. This usually indicates authentication or URL issues.',
        preview
      );
    }
  }

  private processResponseData(data: string): {
    content: string;
    isJson: boolean;
    parsedContent?: unknown;
  } {
    try {
      const textData = data.trim();

      // Check for HTML error pages
      if (this.isHtmlContent(textData)) {
        const preview = textData.slice(0, this.ERROR_PREVIEW_LENGTH);
        this.logger.error(`Received HTML error page instead of service data: ${preview}`);
        throw new SapFormatError(
          'SAP returned an HTML error page instead of service data. This usually indicates authentication or URL issues.',
          preview
        );
      }

      // Try to parse as JSON
      try {
        const parsedData = JSON.parse(textData);
        return {
          content: JSON.stringify(parsedData, null, 2),
          isJson: true,
          parsedContent: parsedData,
        };
      } catch {
        // Not JSON, treat as plain text/XML
        this.logger.log('Response is not JSON, treating as plain text/XML');
        return {
          content: textData,
          isJson: false,
        };
      }
    } catch (error) {
      this.logger.error('Failed to process SAP response data:', error);
      throw new Error(`SAP system returned invalid response: ${error.message}`);
    }
  }

  private isHtmlContent(content: string): boolean {
    const normalized = content.trim().toLowerCase();
    return normalized.startsWith('<!doctype') || normalized.startsWith('<html');
  }
}

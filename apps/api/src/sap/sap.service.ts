import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { SapConnectionDto, SapODataResponse } from './dto/sap-connection.dto';
import { ConnectionService } from './services/connection.service';
import { AgentDBService } from './services/agentdb.service';
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

  constructor(
    private connectionService: ConnectionService,
    private agentDBService: AgentDBService,
  ) {}

  /**
   * Fetches OData service metadata (XML format) with caching support
   * Following original pattern: 1) Try cache first, 2) Call SAP if not cached, 3) Cache result
   */
  async getMetadata(servicePath: string, connectionInfo: SapConnectionDto): Promise<SapODataResponse> {
    this.logger.debug(`[DEBUG] getMetadata called with servicePath: ${servicePath}`);
    this.logger.debug(`[DEBUG] connectionInfo: ${JSON.stringify({ ...connectionInfo, password: '***' })}`);
    
    const config = this.resolveConfiguration(connectionInfo);
    const fullUrl = this.buildServiceUrl(config.baseUrl, servicePath);
    
    // Step 1: Try to get from AgentDB cache first if cache connection is configured
    if (this.agentDBService && connectionInfo.cacheConnectionName) {
      try {
        // Get AgentDB configuration from connection info
        const agentDBConfig = await this.getAgentDBConfigFromConnectionInfo(connectionInfo);
        if (agentDBConfig) {
          const cachedContent = await this.agentDBService.getCachedMetadata(agentDBConfig, servicePath);
          if (cachedContent) {
            this.logger.log(`[CACHE HIT] Retrieved metadata from AgentDB cache for: ${servicePath}`);
            const { content, isJson, parsedContent } = this.processResponseData(cachedContent);
            return {
              content,
              contentType: 'application/xml',
              url: fullUrl,
              isJson,
              parsedContent,
              dataSource: 'cache',
              cacheInfo: {
                source: 'agentdb',
                timestamp: new Date().toISOString(),
                servicePath
              }
            };
          }
        }
      } catch (error) {
        this.logger.warn(`[CACHE ERROR] Failed to read from cache: ${error.message}`);
      }
    }

    // Step 2: Cache miss - fetch from SAP system
    this.logger.log(`[SAP CALL] Fetching metadata from SAP: ${fullUrl}`);

    try {
      const response = await this.makeHttpRequest(fullUrl, config, {
        Accept: 'application/xml',
      });

      this.validateXmlContent(response.content);
      this.logger.log(`[SAP SUCCESS] Metadata fetched successfully (${response.content.length} characters)`);

      // Step 3: Cache the successful result if cache connection is configured
      if (this.agentDBService && connectionInfo.cacheConnectionName) {
        try {
          const agentDBConfig = await this.getAgentDBConfigFromConnectionInfo(connectionInfo);
          if (agentDBConfig) {
            await this.agentDBService.cacheMetadata(agentDBConfig, servicePath, response.content);
            this.logger.log(`[CACHE WRITE] Stored metadata in AgentDB cache for: ${servicePath}`);
          }
        } catch (error) {
          this.logger.warn(`[CACHE WRITE ERROR] Failed to cache metadata: ${error.message}`);
        }
      }

      return {
        content: response.content,
        contentType: response.contentType || 'application/xml',
        url: fullUrl,
        isJson: false,
        dataSource: 'sap',
        sapInfo: {
          timestamp: new Date().toISOString(),
          servicePath
        }
      };
    } catch (error) {
      this.logger.error(`[SAP ERROR] Failed to fetch metadata from ${fullUrl}: ${error.message}`);
      throw new InternalServerErrorException(`Failed to fetch SAP metadata: ${error.message}`);
    }
  }

  /**
   * Fetches OData service data (JSON format preferred)
   * Following original pattern: 1) Try cache first, 2) Call SAP if not cached, 3) Cache result
   */
  async getData(servicePath: string, connectionInfo: SapConnectionDto): Promise<SapODataResponse> {
    this.logger.debug(`[DEBUG] getData called with servicePath: ${servicePath}`);
    this.logger.debug(`[DEBUG] connectionInfo: ${JSON.stringify({ ...connectionInfo, password: '***' })}`);
    
    const config = this.resolveConfiguration(connectionInfo);
    const fullUrl = this.buildServiceUrl(config.baseUrl, servicePath);
    
    // Step 1: Try to get from AgentDB cache first if cache connection is configured
    if (this.agentDBService && connectionInfo.cacheConnectionName) {
      try {
        // Get AgentDB configuration from connection info
        const agentDBConfig = await this.getAgentDBConfigFromConnectionInfo(connectionInfo);
        if (agentDBConfig) {
          const cachedContent = await this.agentDBService.getCachedData(agentDBConfig, servicePath);
          if (cachedContent) {
            this.logger.log(`[CACHE HIT] Retrieved data from AgentDB cache for: ${servicePath}`);
            const { content, isJson, parsedContent } = this.processResponseData(cachedContent);
            return {
              content,
              contentType: 'application/json',
              url: fullUrl,
              isJson,
              parsedContent,
              dataSource: 'cache',
              cacheInfo: {
                source: 'agentdb',
                timestamp: new Date().toISOString(),
                servicePath
              }
            };
          }
        }
      } catch (error) {
        this.logger.warn(`[CACHE ERROR] Failed to read from cache: ${error.message}`);
      }
    }

    // Step 2: Cache miss - fetch from SAP system
    this.logger.log(`[SAP CALL] Fetching data from SAP: ${fullUrl}`);

    try {
      const response = await this.makeHttpRequest(fullUrl, config, {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      });

      const { content, isJson, parsedContent } = this.processResponseData(response.content);
      this.logger.log(`[SAP SUCCESS] Data fetched successfully (${content.length} characters)`);

      // Step 3: Cache the successful result if cache connection is configured
      if (this.agentDBService && connectionInfo.cacheConnectionName) {
        try {
          const agentDBConfig = await this.getAgentDBConfigFromConnectionInfo(connectionInfo);
          if (agentDBConfig) {
            await this.agentDBService.cacheData(agentDBConfig, servicePath, content);
            this.logger.log(`[CACHE WRITE] Stored data in AgentDB cache for: ${servicePath}`);
          }
        } catch (error) {
          this.logger.warn(`[CACHE WRITE ERROR] Failed to cache data: ${error.message}`);
        }
      }

      return {
        content,
        contentType: response.contentType || 'application/json',
        url: fullUrl,
        isJson,
        parsedContent,
        dataSource: 'sap',
        sapInfo: {
          timestamp: new Date().toISOString(),
          servicePath
        }
      };
    } catch (error) {
      this.logger.error(`[SAP ERROR] Failed to fetch data from ${fullUrl}: ${error.message}`);
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

  /**
   * Get AgentDB configuration from connection info by looking up the cache connection
   */
  private async getAgentDBConfigFromConnectionInfo(connectionInfo: SapConnectionDto): Promise<{ apiKey: string; token: string; database: string; baseUrl: string } | null> {
    if (!connectionInfo.cacheConnectionName) {
      return null;
    }

    try {
      // Find the cache connection by name
      const connections = await this.connectionService.listConnections();
      const cacheConnection = connections.find(conn => 
        conn.name === connectionInfo.cacheConnectionName && conn.type === 'agentdb'
      );

      if (!cacheConnection) {
        this.logger.warn(`[CACHE CONFIG] Cache connection '${connectionInfo.cacheConnectionName}' not found or not AgentDB type`);
        return null;
      }

      return {
        apiKey: cacheConnection.parameters.apiKey,
        token: cacheConnection.parameters.token,
        database: cacheConnection.parameters.database,
        baseUrl: cacheConnection.parameters.baseUrl || 'https://api.agentdb.dev',
      };
    } catch (error) {
      this.logger.error(`[CACHE CONFIG] Failed to get AgentDB config: ${error.message}`);
      return null;
    }
  }

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

  /**
   * Parse OData metadata XML to extract entity sets and their properties
   */
  parseMetadata(xmlContent: string): any {
    try {
      // Simple XML parsing to extract entity sets
      // This is a basic implementation - for production use a proper XML parser
      const entitySets: any[] = [];
      const entityTypes: any[] = [];
      
      // Extract EntitySets
      const entitySetRegex = /<EntitySet[^>]*Name="([^"]*)"[^>]*EntityType="([^"]*)"[^>]*\/?>|<EntitySet[^>]*EntityType="([^"]*)"[^>]*Name="([^"]*)"[^>]*\/?>/g;
      let match;
      
      while ((match = entitySetRegex.exec(xmlContent)) !== null) {
        const entitySetName = match[1] || match[4];
        const entityTypeName = match[2] || match[3];
        
        if (entitySetName && entityTypeName) {
          entitySets.push({
            name: entitySetName,
            entityType: entityTypeName.split('.').pop(), // Remove namespace
            fullEntityType: entityTypeName
          });
        }
      }

      // Extract EntityTypes and their properties
      const entityTypeRegex = /<EntityType[^>]*Name="([^"]*)"[^>]*>([\s\S]*?)<\/EntityType>/g;
      
      while ((match = entityTypeRegex.exec(xmlContent)) !== null) {
        const entityTypeName = match[1];
        const entityTypeContent = match[2];
        
        // Extract properties
        const properties: any[] = [];
        const propertyRegex = /<Property[^>]*Name="([^"]*)"[^>]*Type="([^"]*)"[^>]*(?:Nullable="([^"]*)")?[^>]*\/?>/g;
        let propMatch;
        
        while ((propMatch = propertyRegex.exec(entityTypeContent)) !== null) {
          properties.push({
            name: propMatch[1],
            type: propMatch[2],
            nullable: propMatch[3] !== 'false'
          });
        }

        // Extract key properties
        const keyProperties: string[] = [];
        const keyRegex = /<Key>([\s\S]*?)<\/Key>/;
        const keyMatch = keyRegex.exec(entityTypeContent);
        
        if (keyMatch) {
          const keyPropertyRegex = /<PropertyRef[^>]*Name="([^"]*)"[^>]*\/?>/g;
          let keyPropMatch;
          
          while ((keyPropMatch = keyPropertyRegex.exec(keyMatch[1])) !== null) {
            keyProperties.push(keyPropMatch[1]);
          }
        }

        entityTypes.push({
          name: entityTypeName,
          properties,
          keyProperties
        });
      }

      // Combine entity sets with their type information
      const enrichedEntitySets = entitySets.map(entitySet => {
        const entityType = entityTypes.find(type => type.name === entitySet.entityType);
        return {
          ...entitySet,
          properties: entityType?.properties || [],
          keyProperties: entityType?.keyProperties || []
        };
      });

      return {
        entitySets: enrichedEntitySets,
        entityTypes,
        summary: {
          totalEntitySets: entitySets.length,
          totalEntityTypes: entityTypes.length,
          entitySetNames: entitySets.map(es => es.name)
        }
      };
    } catch (error) {
      this.logger.error('Failed to parse metadata XML:', error);
      throw new Error(`Failed to parse metadata: ${error.message}`);
    }
  }

  /**
   * Fetch OData service data using stored connection with fallback to cache connection
   */
  async getDataWithConnection(servicePath: string, connectionId: string, cacheConnectionId?: string): Promise<SapODataResponse> {
    this.logger.debug(`[DEBUG] getDataWithConnection called with servicePath: ${servicePath}, connectionId: ${connectionId}`);
    
    try {
      // Get the connection
      const { connection, password } = await this.connectionService.getConnectionById(connectionId);
      
      // Check if this is an AgentDB connection - if so, handle it directly
      if (connection.type === 'agentdb') {
        this.logger.log(`[AGENTDB DIRECT] Using AgentDB connection directly: ${connection.name}`);
        
        // Create AgentDB config from connection parameters
        const agentDBConfig = {
          apiKey: connection.parameters.apiKey,
          token: connection.parameters.token,
          database: connection.parameters.database,
          baseUrl: connection.parameters.baseUrl || 'https://api.agentdb.dev',
        };
        
        const cachedContent = await this.agentDBService.getCachedData(agentDBConfig, servicePath);
        if (cachedContent) {
          this.logger.log(`[AGENTDB SUCCESS] Retrieved data from AgentDB for: ${servicePath}`);
          try {
            const parsedContent = JSON.parse(cachedContent);
            return {
              content: cachedContent,
              contentType: 'application/json',
              url: `agentdb://${servicePath}`,
              isJson: true,
              parsedContent: parsedContent,
              dataSource: 'cache',
              cacheInfo: {
                source: 'agentdb',
                timestamp: new Date().toISOString(),
                servicePath
              }
            };
          } catch (parseError) {
            return {
              content: cachedContent,
              contentType: 'application/json',
              url: `agentdb://${servicePath}`,
              isJson: false,
              dataSource: 'cache',
              cacheInfo: {
                source: 'agentdb',
                timestamp: new Date().toISOString(),
                servicePath
              }
            };
          }
        } else {
          throw new Error(`No cached data found in AgentDB for service path: ${servicePath}`);
        }
      }
      
      // Handle SAP connection
      const params = connection.parameters;
      const connectionInfo: SapConnectionDto = {
        baseUrl: params.baseUrl,
        basePath: params.basePath,
        username: params.username,
        password: password,
        timeout: params.timeout,
        rejectUnauthorized: params.rejectUnauthorized,
        userAgent: params.userAgent,
        cacheConnectionName: connection.cacheConnectionId ? 
          (await this.connectionService.getConnectionById(connection.cacheConnectionId)).connection.name : 
          undefined,
      };

      // Try to get data from SAP system
      return await this.getData(servicePath, connectionInfo);
    } catch (error) {
      this.logger.error(`[CONNECTION ERROR] Primary connection failed: ${error.message}`);
      
      // Try fallback to cache connection if specified
      if (cacheConnectionId) {
        try {
          this.logger.warn(`[FALLBACK] Attempting fallback to cache connection: ${cacheConnectionId}`);
          const { connection: cacheConnection } = await this.connectionService.getConnectionById(cacheConnectionId);
          
          if (cacheConnection.type === 'agentdb') {
            // Create AgentDB config from cache connection parameters
            const agentDBConfig = {
              apiKey: cacheConnection.parameters.apiKey,
              token: cacheConnection.parameters.token,
              database: cacheConnection.parameters.database,
              baseUrl: cacheConnection.parameters.baseUrl || 'https://api.agentdb.dev',
            };
            
            const cachedContent = await this.agentDBService.getCachedData(agentDBConfig, servicePath);
            if (cachedContent) {
              this.logger.warn(`[FALLBACK SUCCESS] Using cached data from AgentDB`);
              try {
                const parsedContent = JSON.parse(cachedContent);
                return {
                  content: cachedContent,
                  contentType: 'application/json',
                  url: `fallback-cache://${servicePath}`,
                  isJson: true,
                  parsedContent: parsedContent,
                  dataSource: 'cache',
                  cacheInfo: {
                    source: 'agentdb-fallback',
                    timestamp: new Date().toISOString(),
                    servicePath
                  }
                };
              } catch (parseError) {
                return {
                  content: cachedContent,
                  contentType: 'application/json',
                  url: `fallback-cache://${servicePath}`,
                  isJson: false,
                  dataSource: 'cache',
                  cacheInfo: {
                    source: 'agentdb-fallback',
                    timestamp: new Date().toISOString(),
                    servicePath
                  }
                };
              }
            }
          }
        } catch (fallbackError) {
          this.logger.error(`[FALLBACK ERROR] Cache fallback also failed: ${fallbackError.message}`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Fetch OData metadata using stored connection with fallback to cache connection
   */
  async getMetadataWithConnection(servicePath: string, connectionId: string, cacheConnectionId?: string): Promise<SapODataResponse> {
    this.logger.debug(`[DEBUG] getMetadataWithConnection called with servicePath: ${servicePath}, connectionId: ${connectionId}`);
    
    try {
      // Get the primary SAP connection
      const { connection: sapConnection, password } = await this.connectionService.getConnectionById(connectionId);
      
      const params = sapConnection.parameters;
      const connectionInfo: SapConnectionDto = {
        baseUrl: params.baseUrl,
        basePath: params.basePath,
        username: params.username,
        password: password,
        timeout: params.timeout,
        rejectUnauthorized: params.rejectUnauthorized,
        userAgent: params.userAgent,
        cacheConnectionName: sapConnection.cacheConnectionId ? 
          (await this.connectionService.getConnectionById(sapConnection.cacheConnectionId)).connection.name : 
          undefined,
      };

      // Try to get metadata from SAP system
      return await this.getMetadata(servicePath, connectionInfo);
    } catch (error) {
      this.logger.error(`[SAP ERROR] Primary connection failed: ${error.message}`);
      
      // Try fallback to cache connection if specified
      if (cacheConnectionId) {
        try {
          this.logger.warn(`[SAP FALLBACK] Attempting fallback to cache connection: ${cacheConnectionId}`);
          const { connection: cacheConnection } = await this.connectionService.getConnectionById(cacheConnectionId);
          
          if (cacheConnection.type === 'agentdb') {
            // Create AgentDB config from cache connection parameters
            const agentDBConfig = {
              apiKey: cacheConnection.parameters.apiKey,
              token: cacheConnection.parameters.token,
              database: cacheConnection.parameters.database,
              baseUrl: cacheConnection.parameters.baseUrl || 'https://api.agentdb.dev',
            };
            
            const cachedContent = await this.agentDBService.getCachedMetadata(agentDBConfig, servicePath);
            if (cachedContent) {
              this.logger.warn(`[SAP FALLBACK] Using cached metadata from AgentDB`);
              return {
                content: cachedContent,
                contentType: 'application/xml',
                url: `fallback-cache://${servicePath}`,
                isJson: false,
                dataSource: 'cache',
                cacheInfo: {
                  source: 'agentdb-fallback',
                  timestamp: new Date().toISOString(),
                  servicePath
                }
              };
            }
          }
        } catch (fallbackError) {
          this.logger.error(`[SAP FALLBACK] Cache fallback also failed: ${fallbackError.message}`);
        }
      }
      
      throw error;
    }
  }
}

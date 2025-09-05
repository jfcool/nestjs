import { Controller, Post, Body, Get, Param, Query, Logger } from '@nestjs/common';
import { SapService } from './sap.service';
import { SapConnectionDto, SapODataRequestDto, SapODataResponse } from './dto/sap-connection.dto';

@Controller('sapodata')
export class SapController {
  private readonly logger = new Logger(SapController.name);

  constructor(private readonly sapService: SapService) {}

  /**
   * Fetch OData service data from SAP system
   * POST /sapodata/data
   */
  @Post('data')
  async getSapOData(@Body() request: SapODataRequestDto): Promise<SapODataResponse> {
    this.logger.log(`Fetching SAP OData for service path: ${request.servicePath}`);
    
    if (!request.connectionInfo) {
      throw new Error('Connection information is required');
    }

    return this.sapService.getData(request.servicePath, request.connectionInfo);
  }

  /**
   * Fetch OData metadata from SAP system
   * POST /sapodata/metadata
   */
  @Post('metadata')
  async getSapODataMetadata(@Body() request: SapODataRequestDto): Promise<SapODataResponse> {
    this.logger.log(`Fetching SAP OData metadata for service path: ${request.servicePath}`);
    
    if (!request.connectionInfo) {
      throw new Error('Connection information is required');
    }

    return this.sapService.getMetadata(request.servicePath, request.connectionInfo);
  }

  /**
   * Setup SAP connection settings
   * POST /sapodata/setup
   */
  @Post('setup')
  async setupConnectionSettings(@Body() connectionInfo: SapConnectionDto): Promise<Record<string, any>> {
    this.logger.log('Setting up SAP connection settings');
    return this.sapService.setupConnectionSettings(connectionInfo);
  }

  /**
   * Get SAP service catalog (convenience endpoint)
   * POST /sapodata/catalog
   */
  @Post('catalog')
  async getServiceCatalog(@Body() connectionInfo: SapConnectionDto): Promise<SapODataResponse> {
    this.logger.log('Fetching SAP service catalog');
    // Fetch the actual service catalog from SAP
    const catalogPath = '/sap/opu/odata/IWFND/CATALOGSERVICE;v=2/ServiceCollection';
    return this.sapService.getData(catalogPath, connectionInfo);
  }

  /**
   * Get specific SAP service by name (convenience endpoint)
   * POST /sapodata/service/:serviceName
   */
  @Post('service/:serviceName')
  async getServiceData(
    @Param('serviceName') serviceName: string,
    @Body() connectionInfo: SapConnectionDto,
    @Query('entitySet') entitySet?: string,
    @Query('filter') filter?: string,
    @Query('top') top?: string,
    @Query('skip') skip?: string
  ): Promise<SapODataResponse> {
    this.logger.log(`Fetching SAP service data for: ${serviceName}`);
    
    let servicePath = `/sap/opu/odata/sap/${serviceName}/`;
    
    if (entitySet) {
      servicePath = `/sap/opu/odata/sap/${serviceName}/${entitySet}`;
      
      // Add OData query parameters
      const queryParams: string[] = [];
      if (filter) queryParams.push(`$filter=${encodeURIComponent(filter)}`);
      if (top) queryParams.push(`$top=${top}`);
      if (skip) queryParams.push(`$skip=${skip}`);
      
      if (queryParams.length > 0) {
        servicePath += `?${queryParams.join('&')}`;
      }
    }

    return this.sapService.getData(servicePath, connectionInfo);
  }

  /**
   * Get metadata for specific SAP service (convenience endpoint)
   * POST /sapodata/service/:serviceName/metadata
   */
  @Post('service/:serviceName/metadata')
  async getServiceMetadata(
    @Param('serviceName') serviceName: string,
    @Body() connectionInfo: SapConnectionDto
  ): Promise<SapODataResponse> {
    this.logger.log(`Fetching SAP service metadata for: ${serviceName}`);
    const metadataPath = `/sap/opu/odata/sap/${serviceName}/$metadata`;
    return this.sapService.getMetadata(metadataPath, connectionInfo);
  }

  /**
   * Health check endpoint
   * GET /sapodata/health
   */
  @Get('health')
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get API documentation
   * GET /sapodata/docs
   */
  @Get('docs')
  async getApiDocs(): Promise<Record<string, any>> {
    return {
      title: 'SAP OData Integration API',
      version: '1.0.0',
      description: 'NestJS-based SAP OData integration service',
      endpoints: {
        'POST /sapodata/data': 'Fetch OData service data',
        'POST /sapodata/metadata': 'Fetch OData metadata',
        'POST /sapodata/setup': 'Setup connection settings',
        'POST /sapodata/catalog': 'Get service catalog',
        'POST /sapodata/service/:serviceName': 'Get service data with query options',
        'POST /sapodata/service/:serviceName/metadata': 'Get service metadata',
        'GET /sapodata/health': 'Health check',
        'GET /sapodata/docs': 'API documentation',
      },
      connectionInfo: {
        required: ['username', 'password'],
        optional: ['baseUrl', 'basePath', 'timeout', 'rejectUnauthorized', 'userAgent'],
        examples: {
          directConnection: {
            baseUrl: 'https://your-sap-system:44301',
            username: 'SAP_USER',
            password: 'SAP_PASSWORD',
            rejectUnauthorized: false,
          },
          pathConnection: {
            basePath: 'your-sap-system:44301',
            username: 'SAP_USER',
            password: 'SAP_PASSWORD',
            rejectUnauthorized: false,
          },
        },
      },
      queryParameters: {
        '$filter': 'Filter entities (e.g., "Name eq \'Test\'")',
        '$top': 'Limit number of results',
        '$skip': 'Skip number of results',
        '$orderby': 'Sort results',
        '$select': 'Select specific fields',
        '$expand': 'Expand related entities',
      },
    };
  }
}

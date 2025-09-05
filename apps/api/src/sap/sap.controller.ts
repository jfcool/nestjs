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
   * Get entity sets for a specific service
   * POST /sapodata/service/:serviceName/entitysets
   */
  @Post('service/:serviceName/entitysets')
  async getServiceEntitySets(
    @Param('serviceName') serviceName: string,
    @Body() connectionInfo: SapConnectionDto
  ): Promise<SapODataResponse> {
    this.logger.log(`Fetching entity sets for SAP service: ${serviceName}`);
    
    // Get service document which contains entity sets
    const servicePath = `/sap/opu/odata/sap/${serviceName}/`;
    return this.sapService.getData(servicePath, connectionInfo);
  }

  /**
   * Get data from a specific entity set
   * POST /sapodata/service/:serviceName/entityset/:entitySetName
   */
  @Post('service/:serviceName/entityset/:entitySetName')
  async getEntitySetData(
    @Param('serviceName') serviceName: string,
    @Param('entitySetName') entitySetName: string,
    @Body() body: { connectionInfo: SapConnectionDto; options?: { top?: number; skip?: number; filter?: string; orderby?: string; select?: string; expand?: string } }
  ): Promise<SapODataResponse> {
    this.logger.log(`Fetching data for entity set: ${entitySetName} in service: ${serviceName}`);
    
    let servicePath = `/sap/opu/odata/sap/${serviceName}/${entitySetName}`;
    
    // Add OData query parameters if provided
    if (body.options) {
      const queryParams: string[] = [];
      if (body.options.filter) queryParams.push(`$filter=${encodeURIComponent(body.options.filter)}`);
      if (body.options.top) queryParams.push(`$top=${body.options.top}`);
      if (body.options.skip) queryParams.push(`$skip=${body.options.skip}`);
      if (body.options.orderby) queryParams.push(`$orderby=${encodeURIComponent(body.options.orderby)}`);
      if (body.options.select) queryParams.push(`$select=${encodeURIComponent(body.options.select)}`);
      if (body.options.expand) queryParams.push(`$expand=${encodeURIComponent(body.options.expand)}`);
      
      if (queryParams.length > 0) {
        servicePath += `?${queryParams.join('&')}`;
      }
    }

    return this.sapService.getData(servicePath, body.connectionInfo);
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
   * Parse metadata to extract entity sets and their properties
   * POST /sapodata/service/:serviceName/metadata/parsed
   */
  @Post('service/:serviceName/metadata/parsed')
  async getParsedMetadata(
    @Param('serviceName') serviceName: string,
    @Body() connectionInfo: SapConnectionDto
  ): Promise<any> {
    this.logger.log(`Fetching and parsing SAP service metadata for: ${serviceName}`);
    const metadataPath = `/sap/opu/odata/sap/${serviceName}/$metadata`;
    const metadataResponse = await this.sapService.getMetadata(metadataPath, connectionInfo);
    
    // Parse the XML metadata to extract entity sets and their properties
    return this.sapService.parseMetadata(metadataResponse.content);
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
      description: 'NestJS-based SAP OData integration service with EntitySets support',
      endpoints: {
        'POST /sapodata/data': 'Fetch OData service data',
        'POST /sapodata/metadata': 'Fetch OData metadata',
        'POST /sapodata/setup': 'Setup connection settings',
        'POST /sapodata/catalog': 'Get service catalog',
        'POST /sapodata/service/:serviceName': 'Get service data with query options',
        'POST /sapodata/service/:serviceName/metadata': 'Get service metadata',
        'POST /sapodata/service/:serviceName/metadata/parsed': 'Get parsed metadata with entity sets',
        'POST /sapodata/service/:serviceName/entitysets': 'Get entity sets for a service',
        'POST /sapodata/service/:serviceName/entityset/:entitySetName': 'Get data from specific entity set',
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
      entitySetOptions: {
        top: 'Number - Limit results (e.g., 50)',
        skip: 'Number - Skip results (e.g., 100)',
        filter: 'String - OData filter expression',
        orderby: 'String - Sort expression (e.g., "Name asc")',
        select: 'String - Select specific fields (e.g., "Name,Description")',
        expand: 'String - Expand related entities',
      },
    };
  }
}

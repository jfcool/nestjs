import { Controller, Post, Body, Get, Param, Query, Logger, Delete, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { SapService } from './sap.service';
import { SapConnectionDto, SapODataRequestDto, SapODataResponse } from './dto/sap-connection.dto';
import { ConnectionService } from './services/connection.service';
import { SapCloudSdkService } from './services/sap-cloud-sdk.service';
import { SapCloudSdkLocalService } from './services/sap-cloud-sdk-local.service';
import type { SapCloudSdkRequestDto as BtpSapCloudSdkRequestDto, SapCloudSdkResponse as BtpSapCloudSdkResponse } from './services/sap-cloud-sdk.service';
import type { SapCloudSdkRequestDto, SapCloudSdkResponse } from './services/sap-cloud-sdk-local.service';
import type { CreateConnectionDto, UpdateConnectionDto } from './services/connection.service';

@ApiBearerAuth()
@Controller('sapodata')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class SapController {
  private readonly logger = new Logger(SapController.name);

  constructor(
    private readonly sapService: SapService,
    private readonly connectionService: ConnectionService,
    private readonly sapCloudSdkService: SapCloudSdkService,
    private readonly sapCloudSdkLocalService: SapCloudSdkLocalService,
  ) {}

  /**
   * Fetch OData service data from SAP system
   * POST /sapodata/data
   */
  @Post('data')
  @RequirePermissions('sapodata')
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
  @RequirePermissions('sapodata')
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
  @RequirePermissions('sapodata')
  async setupConnectionSettings(@Body() connectionInfo: SapConnectionDto): Promise<Record<string, any>> {
    this.logger.log('Setting up SAP connection settings');
    return this.sapService.setupConnectionSettings(connectionInfo);
  }

  /**
   * Get SAP service catalog (convenience endpoint)
   * POST /sapodata/catalog
   */
  @Post('catalog')
  @RequirePermissions('sapodata')
  async getServiceCatalog(@Body() connectionInfo: SapConnectionDto): Promise<SapODataResponse> {
    this.logger.log('Fetching SAP service catalog');
    // Fetch the actual service catalog from SAP with filter to exclude ZUI_ services
    const catalogPath = '/sap/opu/odata/IWFND/CATALOGSERVICE;v=2/ServiceCollection?$format=json&$filter=not startswith(TechnicalServiceName,\'ZUI_\')';
    return this.sapService.getData(catalogPath, connectionInfo);
  }

  /**
   * Get entity sets for a specific service
   * POST /sapodata/service/:serviceName/entitysets
   */
  @Post('service/:serviceName/entitysets')
  @RequirePermissions('sapodata')
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
  @RequirePermissions('sapodata')
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
  @RequirePermissions('sapodata')
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
  @RequirePermissions('sapodata')
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
  @RequirePermissions('sapodata')
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

  // Connection Management Endpoints

  /**
   * Get all connections
   * GET /sapodata/connections
   */
  @Get('connections')
  @RequirePermissions('sapodata')
  async getConnections() {
    this.logger.log('Fetching all SAP connections');
    return this.connectionService.listConnections();
  }

  /**
   * Create a new connection
   * POST /sapodata/connections
   */
  @Post('connections')
  @RequirePermissions('sapodata')
  async createConnection(@Body() createConnectionDto: CreateConnectionDto) {
    this.logger.log(`Creating new SAP connection: ${createConnectionDto.name}`);
    return this.connectionService.createConnection(createConnectionDto);
  }

  /**
   * Get connection by ID
   * GET /sapodata/connections/:id
   */
  @Get('connections/:id')
  @RequirePermissions('sapodata')
  async getConnection(@Param('id') id: string) {
    this.logger.log(`Fetching SAP connection: ${id}`);
    const { connection } = await this.connectionService.getConnectionById(id);
    return connection; // Don't return the password
  }

  /**
   * Update connection
   * PUT /sapodata/connections/:id
   */
  @Put('connections/:id')
  @RequirePermissions('sapodata')
  async updateConnection(
    @Param('id') id: string,
    @Body() updateConnectionDto: UpdateConnectionDto
  ) {
    this.logger.log(`Updating SAP connection: ${id}`);
    return this.connectionService.updateConnection(id, updateConnectionDto);
  }

  /**
   * Delete connection
   * DELETE /sapodata/connections/:id
   */
  @Delete('connections/:id')
  @RequirePermissions('sapodata')
  async deleteConnection(@Param('id') id: string) {
    this.logger.log(`Deleting SAP connection: ${id}`);
    await this.connectionService.deleteConnection(id);
    return { message: 'Connection deleted successfully' };
  }

  /**
   * Test connection
   * POST /sapodata/connections/:id/test
   */
  @Post('connections/:id/test')
  @RequirePermissions('sapodata')
  async testConnection(@Param('id') id: string) {
    this.logger.log(`Testing SAP connection: ${id}`);
    return this.connectionService.testConnection(id);
  }

  /**
   * Fetch OData service data using stored connection
   * POST /sapodata/connection/:connectionId/data
   */
  @Post('connection/:connectionId/data')
  @RequirePermissions('sapodata')
  async getDataWithConnection(
    @Param('connectionId') connectionId: string,
    @Body() request: { servicePath: string; cacheConnectionId?: string }
  ): Promise<SapODataResponse> {
    this.logger.log(`Fetching SAP data for service path: ${request.servicePath} using connection: ${connectionId}`);
    return this.sapService.getDataWithConnection(request.servicePath, connectionId, request.cacheConnectionId);
  }

  /**
   * Fetch OData metadata using stored connection
   * POST /sapodata/connection/:connectionId/metadata
   */
  @Post('connection/:connectionId/metadata')
  @RequirePermissions('sapodata')
  async getMetadataWithConnection(
    @Param('connectionId') connectionId: string,
    @Body() request: { servicePath: string; cacheConnectionId?: string }
  ): Promise<SapODataResponse> {
    this.logger.log(`Fetching SAP metadata for service path: ${request.servicePath} using connection: ${connectionId}`);
    return this.sapService.getMetadataWithConnection(request.servicePath, connectionId, request.cacheConnectionId);
  }

  /**
   * Get SAP service catalog using stored connection
   * POST /sapodata/connection/:connectionId/catalog
   */
  @Post('connection/:connectionId/catalog')
  @RequirePermissions('sapodata')
  async getServiceCatalogWithConnection(
    @Param('connectionId') connectionId: string,
    @Body() request: { cacheConnectionId?: string }
  ): Promise<SapODataResponse> {
    this.logger.log(`Fetching SAP service catalog using connection: ${connectionId}`);
    const catalogPath = '/sap/opu/odata/IWFND/CATALOGSERVICE;v=2/ServiceCollection?$format=json&$filter=not startswith(TechnicalServiceName,\'ZUI_\')';
    return this.sapService.getDataWithConnection(catalogPath, connectionId, request.cacheConnectionId);
  }

  /**
   * Parse metadata to extract entity sets using stored connection
   * POST /sapodata/connection/:connectionId/service/:serviceName/metadata/parsed
   */
  @Post('connection/:connectionId/service/:serviceName/metadata/parsed')
  @RequirePermissions('sapodata')
  async getParsedMetadataWithConnection(
    @Param('connectionId') connectionId: string,
    @Param('serviceName') serviceName: string,
    @Body() request: { cacheConnectionId?: string }
  ): Promise<any> {
    this.logger.log(`Fetching and parsing SAP service metadata for: ${serviceName} using connection: ${connectionId}`);
    const metadataPath = `/sap/opu/odata/sap/${serviceName}/$metadata`;
    
    // Use the cacheConnectionId from the request body to ensure caching works
    const metadataResponse = await this.sapService.getMetadataWithConnection(
      metadataPath, 
      connectionId, 
      request.cacheConnectionId
    );
    
    // Parse the XML metadata to extract entity sets and their properties
    const parsedMetadata = this.sapService.parseMetadata(metadataResponse.content);
    
    // Return parsed metadata with cache information from the original response
    return {
      ...parsedMetadata,
      dataSource: metadataResponse.dataSource,
      cacheInfo: metadataResponse.cacheInfo,
      sapInfo: metadataResponse.sapInfo
    };
  }

  /**
   * Get data from a specific entity set using stored connection
   * POST /sapodata/connection/:connectionId/service/:serviceName/entityset/:entitySetName
   */
  @Post('connection/:connectionId/service/:serviceName/entityset/:entitySetName')
  @RequirePermissions('sapodata')
  async getEntitySetDataWithConnection(
    @Param('connectionId') connectionId: string,
    @Param('serviceName') serviceName: string,
    @Param('entitySetName') entitySetName: string,
    @Body() body: { options?: { top?: number; skip?: number; filter?: string; orderby?: string; select?: string; expand?: string }; cacheConnectionId?: string }
  ): Promise<SapODataResponse> {
    this.logger.log(`Fetching data for entity set: ${entitySetName} in service: ${serviceName} using connection: ${connectionId}`);
    
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

    return this.sapService.getDataWithConnection(servicePath, connectionId, body.cacheConnectionId);
  }

  // SAP Cloud SDK Endpoints

  /**
   * Execute HTTP request using SAP Cloud SDK (Local Development)
   * POST /sapodata/cloud-sdk/execute
   */
  @Post('cloud-sdk/execute')
  @RequirePermissions('sapodata')
  async executeSapCloudSdkRequest(@Body() request: SapCloudSdkRequestDto): Promise<SapCloudSdkResponse> {
    this.logger.log(`[SAP Cloud SDK Local] Executing request: ${request.servicePath}`);
    return this.sapCloudSdkLocalService.executeRequest(request);
  }

  /**
   * Get Business Partners using SAP Cloud SDK (example from provided code snippet)
   * POST /sapodata/cloud-sdk/business-partners
   */
  @Post('cloud-sdk/business-partners')
  @RequirePermissions('sapodata')
  async getBusinessPartnersWithCloudSdk(
    @Body() request: { connectionId: string; top?: number }
  ): Promise<SapCloudSdkResponse> {
    this.logger.log(`[SAP Cloud SDK Local] Fetching Business Partners with top: ${request.top || 5}`);
    return this.sapCloudSdkLocalService.getBusinessPartners(request.connectionId, request.top);
  }

  /**
   * SAP Cloud SDK Health Check (Local Development)
   * GET /sapodata/cloud-sdk/health
   */
  @Get('cloud-sdk/health')
  async sapCloudSdkHealthCheck(): Promise<{ status: string; mode: string; timestamp: string }> {
    return this.sapCloudSdkLocalService.healthCheck();
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

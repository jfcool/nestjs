import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { executeHttpRequest, HttpRequestConfig } from '@sap-cloud-sdk/http-client';
import { Destination } from '@sap-cloud-sdk/connectivity';
import { ConnectionService } from './connection.service';
import * as https from 'https';

export interface SapCloudSdkRequestDto {
  connectionId: string;
  servicePath: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  data?: any;
}

export interface SapCloudSdkResponse {
  data: any;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  url: string;
  timestamp: string;
  source: 'sap-cloud-sdk-local';
}

@Injectable()
export class SapCloudSdkLocalService {
  private readonly logger = new Logger(SapCloudSdkLocalService.name);

  constructor(
    private connectionService: ConnectionService
  ) {
    this.logger.log('SapCloudSdkLocalService initialized for local development using SAP Cloud SDK');
  }

  /**
   * Create a local destination object from connection parameters
   */
  private async createLocalDestination(connectionId: string): Promise<Destination & { url: string }> {
    const { connection, password } = await this.connectionService.getConnectionById(connectionId);
    
    if (connection.type !== 'sap') {
      throw new BadRequestException('Connection must be of type SAP');
    }

    const params = connection.parameters;
    const baseUrl = params.baseUrl || `https://${params.basePath}`;

    if (!baseUrl) {
      throw new BadRequestException('Base URL is required for SAP connection');
    }

    // Create a destination object that the SAP Cloud SDK can use locally
    const destination: Destination & { url: string } = {
      name: connection.name,
      url: baseUrl, // Ensure this is always a string
      authentication: 'BasicAuthentication',
      username: params.username,
      password: password,
      sapClient: params.client || '100',
      // Additional properties for local development
      proxyType: 'Internet'
    };

    // Add SSL handling if needed (as additional property)
    if (params.rejectUnauthorized === false) {
      (destination as any).trustAll = 'true';
    }

    this.logger.debug(`[SAP Cloud SDK Local] Created destination: ${JSON.stringify({
      ...destination,
      password: '***'
    })}`);

    return destination;
  }

  /**
   * Execute HTTP request using SAP Cloud SDK with local destination
   * This uses the actual SAP Cloud SDK with all its benefits (CSRF, token handling, etc.)
   */
  async executeRequest(request: SapCloudSdkRequestDto): Promise<SapCloudSdkResponse> {
    this.logger.log(`[SAP Cloud SDK Local] Executing request to: ${request.servicePath}`);
    
    try {
      // Create local destination
      const destination = await this.createLocalDestination(request.connectionId);

      // Prepare request config for SAP Cloud SDK with SSL certificate handling
      const requestConfig: HttpRequestConfig = {
        method: request.method || 'GET',
        url: request.servicePath,
        headers: request.headers,
        data: request.data,
        timeout: 30000,
        // Add HTTPS agent to ignore SSL certificate errors for development
        httpsAgent: new https.Agent({
          rejectUnauthorized: false // Ignore SSL certificate errors for development
        })
      };

      this.logger.debug(`[SAP Cloud SDK Local] Request config: ${JSON.stringify({
        ...requestConfig,
        destination: { ...destination, password: '***' },
        httpsAgent: '[HTTPS Agent with rejectUnauthorized: false]'
      })}`);

      // Execute request using SAP Cloud SDK
      const response = await executeHttpRequest(destination, requestConfig);

      this.logger.log(`[SAP Cloud SDK Local] Request successful - Status: ${response.status}`);

      return {
        data: response.data,
        status: response.status,
        statusText: response.statusText || 'OK',
        headers: response.headers ? Object.fromEntries(
          Object.entries(response.headers).map(([key, value]) => [key, String(value)])
        ) : {},
        url: `${destination.url}${request.servicePath}`,
        timestamp: new Date().toISOString(),
        source: 'sap-cloud-sdk-local'
      };

    } catch (error) {
      this.logger.error(`[SAP Cloud SDK Local] Request failed:`, error);
      
      // Handle SAP Cloud SDK specific errors
      if (error.response) {
        // HTTP error response
        this.logger.error(`[SAP Cloud SDK Local] HTTP Error: ${error.response.status} - ${error.response.statusText}`);
        throw new InternalServerErrorException({
          message: `SAP Cloud SDK request failed: ${error.response.status} ${error.response.statusText}`,
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        // Network errors
        throw new InternalServerErrorException(`Network error: Unable to connect to SAP system`);
      } else if (error.code === 'ETIMEDOUT') {
        // Timeout errors
        throw new InternalServerErrorException(`Request timeout: SAP system did not respond within 30 seconds`);
      } else {
        // Other errors (including SAP Cloud SDK specific errors)
        throw new InternalServerErrorException(`SAP Cloud SDK error: ${error.message}`);
      }
    }
  }

  /**
   * Get Business Partner data using SAP Cloud SDK (example from the provided code snippet)
   * This replicates your original code but with local destination
   */
  async getBusinessPartners(connectionId: string, top: number = 5): Promise<SapCloudSdkResponse> {
    this.logger.log(`[SAP Cloud SDK Local] Fetching Business Partners with top: ${top}`);
    
    try {
      // Create local destination (equivalent to getDestination({ destinationName: 'S4HANA_ONPREM' }))
      const destination = await this.createLocalDestination(connectionId);

      // Your original request config with SSL certificate handling
      const requestConfig: HttpRequestConfig = {
        method: 'GET',
        url: `/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner?$top=${top}`,
        // Add HTTPS agent to ignore SSL certificate errors for development
        httpsAgent: new https.Agent({
          rejectUnauthorized: false // Ignore SSL certificate errors for development
        })
      };

      // Execute using SAP Cloud SDK (equivalent to executeHttpRequest(dest, req))
      const { data } = await executeHttpRequest(destination, requestConfig);
      
      this.logger.log(`[SAP Cloud SDK Local] Business Partners retrieved successfully`);
      console.log(data); // Your original console.log(data)

      return {
        data,
        status: 200,
        statusText: 'OK',
        headers: {},
        url: `${destination.url}${requestConfig.url}`,
        timestamp: new Date().toISOString(),
        source: 'sap-cloud-sdk-local'
      };

    } catch (error) {
      this.logger.error(`[SAP Cloud SDK Local] Business Partners request failed:`, error);
      throw new InternalServerErrorException(`Failed to fetch Business Partners: ${error.message}`);
    }
  }

  /**
   * Health check for SAP Cloud SDK Local service
   */
  async healthCheck(): Promise<{ status: string; mode: string; timestamp: string; sdkVersion: string }> {
    return {
      status: 'ok',
      mode: 'local-development-with-sap-cloud-sdk',
      timestamp: new Date().toISOString(),
      sdkVersion: 'Using SAP Cloud SDK with local destinations'
    };
  }
}

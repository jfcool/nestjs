/**
 * @fileoverview SAP Cloud SDK Service for Professional SAP Integration
 * 
 * This service provides enterprise-grade SAP connectivity using the official SAP Cloud SDK.
 * It supports both BTP (Business Technology Platform) destinations and stored connections,
 * enabling seamless integration with SAP systems in cloud and on-premise environments.
 * 
 * Key Features:
 * - Official SAP Cloud SDK integration for reliable connectivity
 * - Support for BTP destinations and custom connections
 * - Comprehensive error handling and logging
 * - Business Partner API examples and patterns
 * - Health check capabilities for monitoring
 * - Flexible HTTP request execution with full OData support
 * 
 * Usage Examples:
 * - Execute OData queries against SAP systems
 * - Retrieve Business Partner data with pagination
 * - Handle authentication and connectivity automatically
 * - Monitor service health and SDK version
 * 
 * @author NestJS SAP Integration Team
 * @version 1.0.0
 * @since 2024
 */

import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { executeHttpRequest, HttpRequestConfig } from '@sap-cloud-sdk/http-client';
import { getDestination } from '@sap-cloud-sdk/connectivity';
import { ConnectionService } from './connection.service';

// Load BTP environment variables if available
try {
  require('@sap/xsenv/load');
} catch (error) {
  // xsenv not available, continuing without BTP environment loading
  console.log('xsenv not available, continuing without BTP environment loading');
}

export interface SapCloudSdkRequestDto {
  destinationName?: string;
  servicePath: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  data?: any;
  connectionId?: string;
}

export interface SapCloudSdkResponse {
  data: any;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  url: string;
  timestamp: string;
  source: 'sap-cloud-sdk';
}

@Injectable()
export class SapCloudSdkService {
  private readonly logger = new Logger(SapCloudSdkService.name);

  constructor(private connectionService: ConnectionService) {
    this.logger.log('SapCloudSdkService initialized successfully');
  }

  /**
   * Execute HTTP request using SAP Cloud SDK
   * This method demonstrates the usage of SAP Cloud SDK for OData calls
   */
  async executeRequest(request: SapCloudSdkRequestDto): Promise<SapCloudSdkResponse> {
    this.logger.log(`[SAP Cloud SDK] Executing request to: ${request.servicePath}`);
    
    try {
      let destination;
      
      // If connectionId is provided, use stored connection to create destination
      if (request.connectionId) {
        destination = await this.createDestinationFromConnection(request.connectionId);
      } else if (request.destinationName) {
        // Use destination name (for BTP environments)
        destination = await getDestination({ destinationName: request.destinationName });
        if (!destination) {
          throw new Error(`Destination '${request.destinationName}' not found`);
        }
      } else {
        throw new BadRequestException('Either destinationName or connectionId is required');
      }

      // Prepare HTTP request configuration
      const httpConfig: HttpRequestConfig = {
        method: request.method || 'GET',
        url: request.servicePath,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...request.headers
        }
      };

      // Add data for POST/PUT/PATCH requests
      if (request.data && ['POST', 'PUT', 'PATCH'].includes(httpConfig.method || 'GET')) {
        httpConfig.data = request.data;
      }

      this.logger.debug(`[SAP Cloud SDK] Request config: ${JSON.stringify({
        ...httpConfig,
        url: httpConfig.url
      })}`);

      // Execute the request using SAP Cloud SDK
      const response = await executeHttpRequest(destination, httpConfig);

      this.logger.log(`[SAP Cloud SDK] Request successful - Status: ${response.status}`);

      return {
        data: response.data,
        status: response.status,
        statusText: response.statusText || 'OK',
        headers: response.headers || {},
        url: request.servicePath,
        timestamp: new Date().toISOString(),
        source: 'sap-cloud-sdk'
      };

    } catch (error) {
      this.logger.error(`[SAP Cloud SDK] Request failed:`, error);
      this.logger.error(`[SAP Cloud SDK] Error details:`, {
        message: error.message,
        stack: error.stack,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
        config: error.config,
        code: error.code,
        errno: error.errno,
        syscall: error.syscall,
        hostname: error.hostname
      });
      
      // Handle different types of errors
      if (error.response) {
        // HTTP error response
        throw new InternalServerErrorException({
          message: `SAP Cloud SDK request failed: ${error.message}`,
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        // Network errors
        throw new InternalServerErrorException(`Network error: Unable to connect to SAP system`);
      } else {
        // Other errors
        throw new InternalServerErrorException(`SAP Cloud SDK error: ${error.message}`);
      }
    }
  }

  /**
   * Create a destination object from stored connection
   * This simulates how destinations work in BTP environments
   */
  private async createDestinationFromConnection(connectionId: string): Promise<any> {
    try {
      const { connection, password } = await this.connectionService.getConnectionById(connectionId);
      
      if (connection.type !== 'sap') {
        throw new Error('Connection must be of type SAP');
      }

      const params = connection.parameters;
      
      // Create destination-like object
      const destination = {
        url: params.baseUrl || `https://${params.basePath}`,
        username: params.username,
        password: password,
        authentication: 'BasicAuthentication',
        name: connection.name,
        // Additional properties that might be needed
        proxyType: 'Internet',
        trustAll: !params.rejectUnauthorized,
        timeout: params.timeout || 30000
      };

      this.logger.debug(`[SAP Cloud SDK] Created destination from connection: ${connection.name}`);
      
      return destination;
    } catch (error) {
      this.logger.error(`[SAP Cloud SDK] Failed to create destination from connection: ${error.message}`);
      throw new BadRequestException(`Invalid connection: ${error.message}`);
    }
  }

  /**
   * Get Business Partner data using SAP Cloud SDK (example from the provided code snippet)
   */
  async getBusinessPartners(connectionId: string, top: number = 5): Promise<SapCloudSdkResponse> {
    const request: SapCloudSdkRequestDto = {
      connectionId,
      servicePath: `/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner?$top=${top}`,
      method: 'GET'
    };

    return this.executeRequest(request);
  }

  /**
   * Health check for SAP Cloud SDK service
   */
  async healthCheck(): Promise<{ status: string; sdkVersion: string; timestamp: string }> {
    try {
      // Try to import SDK modules to verify they're working
      const { version } = require('@sap-cloud-sdk/http-client/package.json');
      
      return {
        status: 'ok',
        sdkVersion: version,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`[SAP Cloud SDK] Health check failed: ${error.message}`);
      throw new InternalServerErrorException('SAP Cloud SDK is not properly configured');
    }
  }
}

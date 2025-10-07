import { Injectable, Logger, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DATABASE_CONNECTION } from '../../database/database.module';
import * as schema from '../../database/schema';
import { SecretService } from './secret.service';
import { SapConnectionDto } from '../dto/sap-connection.dto';

// Re-export ConnectionType for compatibility
export enum ConnectionType {
  SAP = 'sap',
  AGENTDB = 'agentdb',
}

export enum SecretType {
  PASSWORD = 'password',
  API_KEY = 'api_key',
  TOKEN = 'token',
  CERTIFICATE = 'certificate',
  OTHER = 'other',
}

export interface CreateConnectionDto {
  name: string;
  type: ConnectionType;
  description?: string;
  parameters: Record<string, any>;
  cacheConnectionId?: string;
  createdBy?: string;
}

export interface UpdateConnectionDto {
  name?: string;
  description?: string;
  parameters?: Record<string, any>;
  cacheConnectionId?: string;
  isActive?: boolean;
  updatedBy?: string;
}

@Injectable()
export class ConnectionService {
  private readonly logger = new Logger(ConnectionService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private secretService: SecretService,
  ) {}

  /**
   * Create a new connection
   */
  async createConnection(dto: CreateConnectionDto) {
    try {
      // Check if connection with same name already exists
      const existingConnection = await this.db.query.connections.findFirst({
        where: eq(schema.connections.name, dto.name),
      });
      
      if (existingConnection) {
        throw new BadRequestException(`Connection with name '${dto.name}' already exists`);
      }

      // Handle password encryption for connections that have passwords
      let processedParameters = { ...dto.parameters };
      if (dto.parameters.password) {
        const passwordSecretName = `connection-${dto.name}-password`;
        const passwordSecret = await this.secretService.createSecret(
          passwordSecretName,
          dto.parameters.password,
          SecretType.PASSWORD,
          `Password for connection: ${dto.name}`,
          undefined,
          dto.createdBy
        );
        
        // Replace password with secret reference
        processedParameters.passwordSecretId = passwordSecret.id;
        delete processedParameters.password;
      }

      // Create connection
      const [connection] = await this.db
        .insert(schema.connections)
        .values({
          name: dto.name,
          type: dto.type as any,
          description: dto.description ?? null,
          parameters: processedParameters,
          cacheConnectionId: dto.cacheConnectionId ?? null,
          isActive: true,
          createdBy: dto.createdBy ?? null,
        })
        .returning();

      this.logger.log(`Created connection: ${dto.name} (${dto.type})`);
      
      return connection;
    } catch (error) {
      this.logger.error(`Failed to create connection '${dto.name}':`, error);
      throw error;
    }
  }

  /**
   * Get connection by ID with decrypted password
   */
  async getConnectionById(id: string): Promise<{ connection: any; password?: string }> {
    try {
      const connection = await this.db.query.connections.findFirst({
        where: eq(schema.connections.id, id),
      });
      
      if (!connection || !connection.isActive) {
        throw new NotFoundException(`Connection with ID '${id}' not found`);
      }

      let password: string | undefined;
      if ((connection.parameters as any).passwordSecretId) {
        const { value } = await this.secretService.getSecretById((connection.parameters as any).passwordSecretId);
        password = value;
      }

      return { connection, password };
    } catch (error) {
      this.logger.error(`Failed to get connection by ID '${id}':`, error);
      throw error;
    }
  }

  /**
   * Get connection by name with decrypted password
   */
  async getConnectionByName(name: string): Promise<{ connection: any; password?: string }> {
    try {
      const connection = await this.db.query.connections.findFirst({
        where: eq(schema.connections.name, name),
      });
      
      if (!connection || !connection.isActive) {
        throw new NotFoundException(`Connection with name '${name}' not found`);
      }

      return this.getConnectionById(connection.id);
    } catch (error) {
      this.logger.error(`Failed to get connection by name '${name}':`, error);
      throw error;
    }
  }

  /**
   * Convert stored connection to SapConnectionDto format (for SAP connections)
   */
  async getConnectionDto(nameOrId: string): Promise<SapConnectionDto> {
    try {
      let connectionData;
      
      // Try to get by ID first, then by name
      try {
        connectionData = await this.getConnectionById(nameOrId);
      } catch {
        connectionData = await this.getConnectionByName(nameOrId);
      }

      const { connection, password } = connectionData;

      if (connection.type !== ConnectionType.SAP) {
        throw new BadRequestException(`Connection '${nameOrId}' is not a SAP connection`);
      }

      const params = connection.parameters;
      return {
        baseUrl: params.baseUrl,
        basePath: params.basePath,
        username: params.username,
        password: password || '',
        timeout: params.timeout || 30000,
        rejectUnauthorized: params.rejectUnauthorized || false,
        userAgent: params.userAgent || 'NestJS-SAP-OData-Client',
        cacheConnectionName: connection.cacheConnectionId ? 
          (await this.getConnectionById(connection.cacheConnectionId)).connection.name : 
          undefined
      };
    } catch (error) {
      this.logger.error(`Failed to get connection DTO for '${nameOrId}':`, error);
      throw error;
    }
  }

  /**
   * Update a connection
   */
  async updateConnection(id: string, dto: UpdateConnectionDto) {
    try {
      const connection = await this.db.query.connections.findFirst({
        where: eq(schema.connections.id, id),
      });
      
      if (!connection) {
        throw new NotFoundException(`Connection with ID '${id}' not found`);
      }

      // Handle password update if provided
      let processedParameters = { ...(connection.parameters as any) };
      if (dto.parameters?.password) {
        if ((connection.parameters as any).passwordSecretId) {
          // Update existing secret
          await this.secretService.updateSecret(
            (connection.parameters as any).passwordSecretId,
            dto.parameters.password,
            undefined,
            undefined,
            dto.updatedBy
          );
        } else {
          // Create new secret
          const passwordSecretName = `connection-${connection.name}-password`;
          const passwordSecret = await this.secretService.createSecret(
            passwordSecretName,
            dto.parameters.password,
            SecretType.PASSWORD,
            `Password for connection: ${connection.name}`,
            undefined,
            dto.updatedBy
          );
          processedParameters.passwordSecretId = passwordSecret.id;
        }
        
        // Remove password from parameters
        const { password, ...otherParams } = dto.parameters;
        processedParameters = { ...processedParameters, ...otherParams };
      } else if (dto.parameters) {
        processedParameters = { ...processedParameters, ...dto.parameters };
      }

      // Check for name conflicts if name is being changed
      if (dto.name && dto.name !== connection.name) {
        const existingConnection = await this.db.query.connections.findFirst({
          where: eq(schema.connections.name, dto.name),
        });
        
        if (existingConnection) {
          throw new BadRequestException(`Connection with name '${dto.name}' already exists`);
        }
      }

      // Build update data
      const updateData: Partial<typeof schema.connections.$inferInsert> = {};
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.parameters !== undefined) updateData.parameters = processedParameters;
      if (dto.cacheConnectionId !== undefined) updateData.cacheConnectionId = dto.cacheConnectionId;
      if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
      if (dto.updatedBy !== undefined) updateData.updatedBy = dto.updatedBy;

      const [updatedConnection] = await this.db
        .update(schema.connections)
        .set(updateData)
        .where(eq(schema.connections.id, id))
        .returning();
      
      this.logger.log(`Updated connection: ${connection.name}`);
      
      return updatedConnection;
    } catch (error) {
      this.logger.error(`Failed to update connection '${id}':`, error);
      throw error;
    }
  }

  /**
   * Delete a connection (soft delete)
   */
  async deleteConnection(id: string): Promise<void> {
    try {
      const connection = await this.db.query.connections.findFirst({
        where: eq(schema.connections.id, id),
      });
      
      if (!connection) {
        throw new NotFoundException(`Connection with ID '${id}' not found`);
      }

      // Soft delete the connection
      await this.db
        .update(schema.connections)
        .set({ isActive: false })
        .where(eq(schema.connections.id, id));
      
      // Also deactivate the associated secret if it exists
      if ((connection.parameters as any).passwordSecretId) {
        await this.secretService.deleteSecret((connection.parameters as any).passwordSecretId);
      }
      
      this.logger.log(`Deleted connection: ${connection.name}`);
    } catch (error) {
      this.logger.error(`Failed to delete connection '${id}':`, error);
      throw error;
    }
  }

  /**
   * List all active connections (without passwords)
   */
  async listConnections() {
    try {
      return await this.db.query.connections.findMany({
        where: eq(schema.connections.isActive, true),
        orderBy: [desc(schema.connections.createdAt)],
      });
    } catch (error) {
      this.logger.error('Failed to list connections:', error);
      throw error;
    }
  }

  /**
   * List connections by type
   */
  async listConnectionsByType(type: ConnectionType) {
    try {
      const results = await this.db
        .select()
        .from(schema.connections)
        .where(eq(schema.connections.type, type as any))
        .orderBy(desc(schema.connections.createdAt));
      
      return results.filter(c => c.isActive);
    } catch (error) {
      this.logger.error(`Failed to list connections of type '${type}':`, error);
      throw error;
    }
  }

  /**
   * Check if a connection exists by name
   */
  async connectionExists(name: string): Promise<boolean> {
    try {
      const connection = await this.db.query.connections.findFirst({
        where: eq(schema.connections.name, name),
      });
      return !!connection && connection.isActive;
    } catch (error) {
      this.logger.error(`Failed to check if connection exists '${name}':`, error);
      return false;
    }
  }

  /**
   * Test a connection by attempting to connect
   */
  async testConnection(nameOrId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { connection } = await this.getConnectionById(nameOrId) || await this.getConnectionByName(nameOrId);
      
      // Basic validation based on connection type
      if (connection.type === ConnectionType.SAP) {
        const params = connection.parameters;
        if (!params.baseUrl || !params.username) {
          return {
            success: false,
            message: 'SAP connection missing required parameters (baseUrl, username)'
          };
        }
      } else if (connection.type === ConnectionType.AGENTDB) {
        const params = connection.parameters;
        if (!params.apiKey || !params.database) {
          return {
            success: false,
            message: 'AgentDB connection missing required parameters (apiKey, database)'
          };
        }
      }
      
      return {
        success: true,
        message: 'Connection configuration is valid'
      };
    } catch (error) {
      this.logger.error(`Failed to test connection '${nameOrId}':`, error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

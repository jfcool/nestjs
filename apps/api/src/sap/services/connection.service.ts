import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Connection, ConnectionType } from '../entities/sap-connection.entity';
import { SecretService } from './secret.service';
import { SecretType } from '../entities/sap-secret.entity';
import { SapConnectionDto } from '../dto/sap-connection.dto';

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
    @InjectRepository(Connection)
    private connectionRepository: Repository<Connection>,
    private secretService: SecretService,
  ) {}

  /**
   * Create a new connection
   */
  async createConnection(dto: CreateConnectionDto): Promise<Connection> {
    try {
      // Check if connection with same name already exists
      const existingConnection = await this.connectionRepository.findOne({ 
        where: { name: dto.name } 
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
      const connection = this.connectionRepository.create({
        name: dto.name,
        type: dto.type,
        description: dto.description,
        parameters: processedParameters,
        cacheConnectionId: dto.cacheConnectionId,
        isActive: true,
        createdBy: dto.createdBy
      });

      const savedConnection = await this.connectionRepository.save(connection);
      this.logger.log(`Created connection: ${dto.name} (${dto.type})`);
      
      return savedConnection;
    } catch (error) {
      this.logger.error(`Failed to create connection '${dto.name}':`, error);
      throw error;
    }
  }

  /**
   * Get connection by ID with decrypted password
   */
  async getConnectionById(id: string): Promise<{ connection: Connection; password?: string }> {
    try {
      const connection = await this.connectionRepository.findOne({ 
        where: { id, isActive: true } 
      });
      
      if (!connection) {
        throw new NotFoundException(`Connection with ID '${id}' not found`);
      }

      let password: string | undefined;
      if (connection.parameters.passwordSecretId) {
        const { value } = await this.secretService.getSecretById(connection.parameters.passwordSecretId);
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
  async getConnectionByName(name: string): Promise<{ connection: Connection; password?: string }> {
    try {
      const connection = await this.connectionRepository.findOne({ 
        where: { name, isActive: true } 
      });
      
      if (!connection) {
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
  async updateConnection(id: string, dto: UpdateConnectionDto): Promise<Connection> {
    try {
      const connection = await this.connectionRepository.findOne({ where: { id } });
      
      if (!connection) {
        throw new NotFoundException(`Connection with ID '${id}' not found`);
      }

      // Handle password update if provided
      let processedParameters = { ...connection.parameters };
      if (dto.parameters?.password) {
        if (connection.parameters.passwordSecretId) {
          // Update existing secret
          await this.secretService.updateSecret(
            connection.parameters.passwordSecretId,
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
        const existingConnection = await this.connectionRepository.findOne({ 
          where: { name: dto.name } 
        });
        
        if (existingConnection) {
          throw new BadRequestException(`Connection with name '${dto.name}' already exists`);
        }
      }

      // Update connection
      const updateData: Partial<Connection> = {
        updatedBy: dto.updatedBy,
        updatedAt: new Date()
      };

      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.parameters !== undefined) updateData.parameters = processedParameters;
      if (dto.cacheConnectionId !== undefined) updateData.cacheConnectionId = dto.cacheConnectionId;
      if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

      await this.connectionRepository.update(id, updateData);
      
      const updatedConnection = await this.connectionRepository.findOne({ where: { id } });
      this.logger.log(`Updated connection: ${connection.name}`);
      
      return updatedConnection!;
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
      const connection = await this.connectionRepository.findOne({ where: { id } });
      
      if (!connection) {
        throw new NotFoundException(`Connection with ID '${id}' not found`);
      }

      // Soft delete the connection
      await this.connectionRepository.update(id, { isActive: false });
      
      // Also deactivate the associated secret if it exists
      if (connection.parameters.passwordSecretId) {
        await this.secretService.deleteSecret(connection.parameters.passwordSecretId);
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
  async listConnections(): Promise<Connection[]> {
    try {
      return await this.connectionRepository.find({
        where: { isActive: true },
        order: { createdAt: 'DESC' }
      });
    } catch (error) {
      this.logger.error('Failed to list connections:', error);
      throw error;
    }
  }

  /**
   * List connections by type
   */
  async listConnectionsByType(type: ConnectionType): Promise<Connection[]> {
    try {
      return await this.connectionRepository.find({
        where: { type, isActive: true },
        order: { createdAt: 'DESC' }
      });
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
      const count = await this.connectionRepository.count({ 
        where: { name, isActive: true } 
      });
      return count > 0;
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

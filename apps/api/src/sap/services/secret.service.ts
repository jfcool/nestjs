import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SapSecret, SecretType } from '../entities/sap-secret.entity';
import * as crypto from 'crypto';

@Injectable()
export class SecretService {
  private readonly logger = new Logger(SecretService.name);
  private readonly ENCRYPTION_KEY = process.env.SECRET_ENCRYPTION_KEY || 'default-key-change-in-production';
  private readonly ALGORITHM = 'aes-256-gcm';

  constructor(
    @InjectRepository(SapSecret)
    private secretRepository: Repository<SapSecret>,
  ) {}

  /**
   * Encrypt a secret value
   */
  private encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const key = crypto.scryptSync(this.ENCRYPTION_KEY, 'salt', 32);
      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    } catch (error) {
      this.logger.error('Failed to encrypt secret:', error);
      throw new Error('Failed to encrypt secret');
    }
  }

  /**
   * Decrypt a secret value
   */
  private decrypt(encryptedText: string): string {
    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      const key = crypto.scryptSync(this.ENCRYPTION_KEY, 'salt', 32);
      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Failed to decrypt secret:', error);
      throw new Error('Failed to decrypt secret');
    }
  }

  /**
   * Create a new secret
   */
  async createSecret(
    name: string,
    value: string,
    type: SecretType = SecretType.PASSWORD,
    description?: string,
    expiresAt?: Date,
    createdBy?: string
  ): Promise<SapSecret> {
    try {
      // Check if secret with same name already exists
      const existingSecret = await this.secretRepository.findOne({ where: { name } });
      if (existingSecret) {
        throw new BadRequestException(`Secret with name '${name}' already exists`);
      }

      const encryptedValue = this.encrypt(value);

      const secret = this.secretRepository.create({
        name,
        type,
        encryptedValue,
        description,
        expiresAt,
        createdBy,
        isActive: true,
        accessCount: 0
      });

      const savedSecret = await this.secretRepository.save(secret);
      this.logger.log(`Created secret: ${name}`);
      
      return savedSecret;
    } catch (error) {
      this.logger.error(`Failed to create secret '${name}':`, error);
      throw error;
    }
  }

  /**
   * Get a secret by ID (returns decrypted value)
   */
  async getSecretById(id: string): Promise<{ secret: SapSecret; value: string }> {
    try {
      const secret = await this.secretRepository.findOne({ where: { id, isActive: true } });
      
      if (!secret) {
        throw new NotFoundException(`Secret with ID '${id}' not found`);
      }

      // Check if secret is expired
      if (secret.expiresAt && secret.expiresAt < new Date()) {
        throw new BadRequestException(`Secret '${secret.name}' has expired`);
      }

      const decryptedValue = this.decrypt(secret.encryptedValue);

      // Update access tracking
      await this.secretRepository.update(id, {
        lastAccessedAt: new Date(),
        accessCount: secret.accessCount + 1
      });

      return { secret, value: decryptedValue };
    } catch (error) {
      this.logger.error(`Failed to get secret by ID '${id}':`, error);
      throw error;
    }
  }

  /**
   * Get a secret by name (returns decrypted value)
   */
  async getSecretByName(name: string): Promise<{ secret: SapSecret; value: string }> {
    try {
      const secret = await this.secretRepository.findOne({ where: { name, isActive: true } });
      
      if (!secret) {
        throw new NotFoundException(`Secret with name '${name}' not found`);
      }

      return this.getSecretById(secret.id);
    } catch (error) {
      this.logger.error(`Failed to get secret by name '${name}':`, error);
      throw error;
    }
  }

  /**
   * Update a secret value
   */
  async updateSecret(
    id: string,
    value?: string,
    description?: string,
    expiresAt?: Date,
    updatedBy?: string
  ): Promise<SapSecret> {
    try {
      const secret = await this.secretRepository.findOne({ where: { id } });
      
      if (!secret) {
        throw new NotFoundException(`Secret with ID '${id}' not found`);
      }

      const updateData: Partial<SapSecret> = {
        updatedBy,
        updatedAt: new Date()
      };

      if (value !== undefined) {
        updateData.encryptedValue = this.encrypt(value);
      }

      if (description !== undefined) {
        updateData.description = description;
      }

      if (expiresAt !== undefined) {
        updateData.expiresAt = expiresAt;
      }

      await this.secretRepository.update(id, updateData);
      
      const updatedSecret = await this.secretRepository.findOne({ where: { id } });
      this.logger.log(`Updated secret: ${secret.name}`);
      
      return updatedSecret!;
    } catch (error) {
      this.logger.error(`Failed to update secret '${id}':`, error);
      throw error;
    }
  }

  /**
   * Delete a secret (soft delete by setting isActive to false)
   */
  async deleteSecret(id: string): Promise<void> {
    try {
      const secret = await this.secretRepository.findOne({ where: { id } });
      
      if (!secret) {
        throw new NotFoundException(`Secret with ID '${id}' not found`);
      }

      await this.secretRepository.update(id, { isActive: false });
      this.logger.log(`Deleted secret: ${secret.name}`);
    } catch (error) {
      this.logger.error(`Failed to delete secret '${id}':`, error);
      throw error;
    }
  }

  /**
   * List all active secrets (without decrypted values)
   */
  async listSecrets(): Promise<SapSecret[]> {
    try {
      return await this.secretRepository.find({
        where: { isActive: true },
        order: { createdAt: 'DESC' }
      });
    } catch (error) {
      this.logger.error('Failed to list secrets:', error);
      throw error;
    }
  }

  /**
   * Check if a secret exists by name
   */
  async secretExists(name: string): Promise<boolean> {
    try {
      const count = await this.secretRepository.count({ where: { name, isActive: true } });
      return count > 0;
    } catch (error) {
      this.logger.error(`Failed to check if secret exists '${name}':`, error);
      return false;
    }
  }
}

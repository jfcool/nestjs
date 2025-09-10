import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService, DatabaseConnection } from '@agentdb/sdk';

export interface AgentDBConfig {
  apiKey: string;
  token: string;
  database: string;
  baseUrl?: string;
  debug?: boolean;
}

@Injectable()
export class AgentDBService {
  private readonly logger = new Logger(AgentDBService.name);
  private readonly DEFAULT_BASE_URL = 'https://api.agentdb.dev';

  constructor() {
    // Service is stateless - configurations are passed per request
  }

  /**
   * Create a DatabaseService instance with the provided configuration
   */
  private createDatabaseService(config: AgentDBConfig): DatabaseService {
    const baseUrl = config.baseUrl || this.DEFAULT_BASE_URL;
    return new DatabaseService(baseUrl, config.apiKey, config.debug);
  }

  /**
   * Create a database connection using the official SDK
   */
  private createConnection(config: AgentDBConfig): DatabaseConnection {
    const service = this.createDatabaseService(config);
    return service.connect(config.token, config.database, 'sqlite');
  }

  /**
   * Execute SQL statements against AgentDB using the official SDK
   */
  async execute(config: AgentDBConfig, statements: any): Promise<any> {
    try {
      const connection = this.createConnection(config);
      const result = await connection.execute(statements);

      if (config.debug) {
        this.logger.debug('[AgentDB SDK] Execute result:', result);
      }

      return result;
    } catch (error) {
      this.logger.error(`[AgentDB SDK] Execute failed:`, error);
      throw error;
    }
  }

  /**
   * Get cached data from AgentDB cache
   */
  async getCachedData(
    config: AgentDBConfig,
    servicePath: string,
  ): Promise<string | null> {
    try {
      const cacheKey = this.generateCacheKey(servicePath, 'GET', '');

      const result = await this.execute(config, {
        sql: "SELECT response_content FROM odata_cache WHERE cache_key = ? AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))",
        params: [cacheKey],
      });

      if (result.results?.[0]?.rows?.length > 0) {
        const content = result.results[0].rows[0].response_content as string;

        // Update hit count and last accessed
        await this.execute(config, {
          sql: `UPDATE "odata_cache" SET "hit_count" = "hit_count" + 1, "last_accessed" = datetime('now') WHERE cache_key = ?`,
          params: [cacheKey],
        });

        this.logger.log(
          `[CACHE HIT] Retrieved data from AgentDB cache for: ${servicePath}`,
        );
        return content;
      }

      this.logger.log(`[CACHE MISS] No cached data found for: ${servicePath}`);
      return null;
    } catch (error) {
      this.logger.error(
        `[CACHE ERROR] Failed to get cached data for ${servicePath}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Get cached metadata from AgentDB cache
   */
  async getCachedMetadata(
    config: AgentDBConfig,
    servicePath: string,
  ): Promise<string | null> {
    try {
      const cacheKey = this.generateCacheKey(servicePath, 'GET', 'metadata');

      const result = await this.execute(config, {
        sql: "SELECT response_content FROM odata_cache WHERE cache_key = ? AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))",
        params: [cacheKey],
      });

      if (result.results?.[0]?.rows?.length > 0) {
        const content = result.results[0].rows[0][0] as string;

        // Update hit count and last accessed
        await this.execute(config, {
          sql: "UPDATE odata_cache SET hit_count = hit_count + 1, last_accessed = datetime('now') WHERE cache_key = ?",
          params: [cacheKey],
        });

        this.logger.log(
          `[CACHE HIT] Retrieved metadata from AgentDB cache for: ${servicePath}`,
        );
        return content;
      }

      this.logger.log(
        `[CACHE MISS] No cached metadata found for: ${servicePath}`,
      );
      return null;
    } catch (error) {
      this.logger.error(
        `[CACHE ERROR] Failed to get cached metadata for ${servicePath}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Cache data in AgentDB
   */
  async cacheData(
    config: AgentDBConfig,
    servicePath: string,
    content: string,
    expiresInMinutes?: number,
  ): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(servicePath, 'GET', '');
      const contentLength = Buffer.byteLength(content, 'utf8');
      const responseType = this.detectResponseType(content);

      // Use UPSERT (INSERT OR REPLACE for SQLite)
      const sql = `
        INSERT OR REPLACE INTO odata_cache (
          cache_key, 
          service_path, 
          request_method, 
          request_hash, 
          response_content, 
          response_type, 
          response_status, 
          content_length,
          created_at,
          last_accessed,
          expires_at,
          hit_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ${
          expiresInMinutes ? "datetime('now', '+' || ? || ' minutes')" : 'NULL'
        }, 1)
      `;

      const params = [
        cacheKey,
        servicePath,
        'GET',
        '',
        content,
        responseType,
        200,
        contentLength,
      ];

      if (expiresInMinutes !== undefined) {
        params.push(expiresInMinutes);
      }

      await this.execute(config, { sql, params });

      // Update service statistics
      await this.execute(config, {
        sql: `
          INSERT OR IGNORE INTO odata_services (service_path, total_calls, last_used) 
          VALUES (?, 1, datetime('now'))
        `,
        params: [servicePath],
      });

      await this.execute(config, {
        sql: `
          UPDATE odata_services 
          SET total_calls = total_calls + 1, last_used = datetime('now') 
          WHERE service_path = ?
        `,
        params: [servicePath],
      });

      this.logger.log(
        `[CACHE WRITE] Stored data in AgentDB cache for: ${servicePath}`,
      );
    } catch (error) {
      this.logger.error(
        `[CACHE ERROR] Failed to cache data for ${servicePath}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Cache metadata in AgentDB
   */
  async cacheMetadata(
    config: AgentDBConfig,
    servicePath: string,
    content: string,
    expiresInMinutes?: number,
  ): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(servicePath, 'GET', 'metadata');
      const contentLength = Buffer.byteLength(content, 'utf8');
      const responseType = this.detectResponseType(content);

      // Use UPSERT (INSERT OR REPLACE for SQLite)
      const sql = `
        INSERT OR REPLACE INTO odata_cache (
          cache_key, 
          service_path, 
          request_method, 
          request_hash, 
          response_content, 
          response_type, 
          response_status, 
          content_length,
          created_at,
          last_accessed,
          expires_at,
          hit_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ${
          expiresInMinutes ? "datetime('now', '+' || ? || ' minutes')" : 'NULL'
        }, 1)
      `;

      const params = [
        cacheKey,
        servicePath,
        'GET',
        'metadata',
        content,
        responseType,
        200,
        contentLength,
      ];

      if (expiresInMinutes !== undefined) {
        params.push(expiresInMinutes);
      }

      await this.execute(config, { sql, params });

      // Update service statistics
      await this.execute(config, {
        sql: `
          INSERT OR IGNORE INTO odata_services (service_path, total_calls, last_used) 
          VALUES (?, 1, datetime('now'))
        `,
        params: [servicePath],
      });

      await this.execute(config, {
        sql: `
          UPDATE odata_services 
          SET total_calls = total_calls + 1, last_used = datetime('now') 
          WHERE service_path = ?
        `,
        params: [servicePath],
      });

      this.logger.log(
        `[CACHE WRITE] Stored metadata in AgentDB cache for: ${servicePath}`,
      );
    } catch (error) {
      this.logger.error(
        `[CACHE ERROR] Failed to cache metadata for ${servicePath}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Initialize the cache database schema
   */
  async initializeCacheSchema(config: AgentDBConfig): Promise<void> {
    try {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS odata_cache (
          cache_key TEXT PRIMARY KEY,
          service_path TEXT NOT NULL,
          request_method TEXT NOT NULL DEFAULT 'GET',
          request_hash TEXT NOT NULL,
          response_content TEXT NOT NULL,
          response_type TEXT NOT NULL CHECK (response_type IN ('JSON', 'XML')),
          response_status INTEGER NOT NULL DEFAULT 200,
          content_length INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          last_accessed TEXT NOT NULL DEFAULT (datetime('now')),
          expires_at TEXT,
          hit_count INTEGER NOT NULL DEFAULT 1
        )
      `;

      const createServicesTableSQL = `
        CREATE TABLE IF NOT EXISTS odata_services (
          service_id INTEGER PRIMARY KEY AUTOINCREMENT,
          service_path TEXT UNIQUE NOT NULL,
          service_name TEXT,
          service_version TEXT,
          base_url TEXT,
          authentication_type TEXT,
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now')),
          last_used TEXT DEFAULT (datetime('now')),
          total_calls INTEGER DEFAULT 0
        )
      `;

      const createIndexesSQL = [
        'CREATE INDEX IF NOT EXISTS idx_service_path ON odata_cache(service_path)',
        'CREATE INDEX IF NOT EXISTS idx_created_at ON odata_cache(created_at)',
        'CREATE INDEX IF NOT EXISTS idx_expires_at ON odata_cache(expires_at)',
        'CREATE INDEX IF NOT EXISTS idx_last_accessed ON odata_cache(last_accessed)',
        'CREATE INDEX IF NOT EXISTS idx_service_method_hash ON odata_cache(service_path, request_method, request_hash)',
        'CREATE INDEX IF NOT EXISTS idx_services_path ON odata_services(service_path)',
        'CREATE INDEX IF NOT EXISTS idx_services_last_used ON odata_services(last_used)',
      ];

      // Execute schema creation
      await this.execute(config, { sql: createTableSQL, params: [] });
      await this.execute(config, { sql: createServicesTableSQL, params: [] });

      for (const indexSQL of createIndexesSQL) {
        await this.execute(config, { sql: indexSQL, params: [] });
      }

      this.logger.log('[SCHEMA] AgentDB cache schema initialized successfully');
    } catch (error) {
      this.logger.error(
        '[SCHEMA ERROR] Failed to initialize cache schema:',
        error,
      );
      throw error;
    }
  }

  /**
   * Clean up expired cache entries
   */
  async cleanupExpiredEntries(config: AgentDBConfig): Promise<number> {
    try {
      const result = await this.execute(config, {
        sql: "DELETE FROM odata_cache WHERE expires_at IS NOT NULL AND datetime(expires_at) <= datetime('now')",
        params: [],
      });

      const deletedCount = result.results?.[0]?.rowsAffected || 0;
      if (deletedCount > 0) {
        this.logger.log(
          `[CLEANUP] Removed ${deletedCount} expired cache entries`,
        );
      }

      return deletedCount;
    } catch (error) {
      this.logger.error(
        '[CLEANUP ERROR] Failed to cleanup expired entries:',
        error,
      );
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStatistics(config: AgentDBConfig): Promise<any> {
    try {
      const result = await this.execute(config, {
        sql: `
          SELECT 
            COUNT(*) as total_entries,
            CAST(SUM(content_length) AS REAL) / 1024 / 1024 as total_size_mb,
            AVG(hit_count) as avg_hit_count,
            COUNT(CASE WHEN expires_at IS NOT NULL AND datetime(expires_at) <= datetime('now') THEN 1 END) as expired_entries,
            COUNT(CASE WHEN response_type = 'JSON' THEN 1 END) as json_entries,
            COUNT(CASE WHEN response_type = 'XML' THEN 1 END) as xml_entries,
            MIN(created_at) as oldest_entry,
            MAX(last_accessed) as most_recent_access
          FROM odata_cache
        `,
        params: [],
      });

      return result.results?.[0]?.rows?.[0] || {};
    } catch (error) {
      this.logger.error('[STATS ERROR] Failed to get cache statistics:', error);
      return {};
    }
  }

  /**
   * List databases for a token using the official SDK
   */
  async listDatabases(config: AgentDBConfig): Promise<any[]> {
    try {
      const service = this.createDatabaseService(config);
      const databases = await service.listDatabases(config.token);

      this.logger.log(
        `[AgentDB SDK] Found ${databases.length} databases for token`,
      );
      return databases;
    } catch (error) {
      this.logger.error(`[AgentDB SDK] Failed to list databases:`, error);
      throw error;
    }
  }

  /**
   * Test AgentDB connection
   */
  async testConnection(
    config: AgentDBConfig,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Try to list databases to test the connection
      const databases = await this.listDatabases(config);

      return {
        success: true,
        message: `Connection successful. Found ${databases.length} databases.`,
      };
    } catch (error) {
      this.logger.error(`[AgentDB SDK] Connection test failed:`, error);
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
      };
    }
  }

  private generateCacheKey(
    servicePath: string,
    method: string,
    requestHash: string,
  ): string {
    const crypto = require('crypto');
    const data = `${servicePath}:${method}:${requestHash}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private detectResponseType(content: string): 'JSON' | 'XML' {
    const trimmed = content.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return 'JSON';
    }
    if (trimmed.startsWith('<')) {
      return 'XML';
    }
    return 'JSON'; // default
  }
}

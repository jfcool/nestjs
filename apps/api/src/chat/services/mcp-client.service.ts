import { Injectable, Logger } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import { McpServerConfig } from './mcp.service';

export interface McpMessage {
  jsonrpc: string;
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: any;
}

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpServerCapabilities {
  tools?: { listChanged?: boolean };
  resources?: { subscribe?: boolean; listChanged?: boolean };
  prompts?: { listChanged?: boolean };
  logging?: {};
}

export interface McpInitializeResult {
  protocolVersion: string;
  capabilities: McpServerCapabilities;
  serverInfo: {
    name: string;
    version: string;
  };
}

@Injectable()
export class McpClientService {
  private readonly logger = new Logger(McpClientService.name);
  private servers: Map<string, ChildProcess> = new Map();
  private messageId = 1;
  private pendingRequests: Map<string | number, { resolve: Function; reject: Function }> = new Map();
  private messageBuffers: Map<string, string> = new Map();

  async startServer(serverName: string, config: McpServerConfig): Promise<boolean> {
    try {
      this.logger.log(`Starting MCP server: ${serverName}`);
      
      const childProcess = spawn(config.command, config.args, {
        env: { ...process.env, ...config.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.servers.set(serverName, childProcess);

      // Handle stdout (MCP messages)
      childProcess.stdout?.on('data', (data) => {
        this.processIncomingData(serverName, data.toString());
      });

      // Handle stderr (logs) - don't process as MCP messages
      childProcess.stderr?.on('data', (data) => {
        const message = data.toString().trim();
        if (message) {
          this.logger.debug(`MCP server ${serverName} stderr: ${message}`);
          // Don't process stderr as MCP messages - these are usually log messages
        }
      });

      // Handle process exit
      childProcess.on('exit', (code) => {
        this.logger.log(`MCP server ${serverName} exited with code ${code}`);
        this.servers.delete(serverName);
        this.messageBuffers.delete(serverName);
        // Clear any pending requests for this server
        for (const [id, request] of this.pendingRequests.entries()) {
          request.reject(new Error(`Server ${serverName} disconnected`));
          this.pendingRequests.delete(id);
        }
      });

      childProcess.on('error', (error) => {
        this.logger.error(`MCP server ${serverName} error: ${error.message}`);
        this.servers.delete(serverName);
        this.messageBuffers.delete(serverName);
      });

      // Wait a bit for the process to start and stabilize
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if process is still running
      if (!this.servers.has(serverName) || childProcess.killed) {
        throw new Error(`MCP server ${serverName} failed to start`);
      }

      // Initialize the server with retry logic
      let initResult;
      let retries = 3;
      while (retries > 0) {
        try {
          initResult = await this.initialize(serverName);
          break;
        } catch (error) {
          retries--;
          if (retries === 0) {
            throw error;
          }
          this.logger.warn(`MCP server ${serverName} initialization failed, retrying... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      this.logger.log(`MCP server ${serverName} initialized successfully`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to start MCP server ${serverName}: ${error.message}`);
      this.servers.delete(serverName);
      this.messageBuffers.delete(serverName);
      return false;
    }
  }

  private async initialize(serverName: string): Promise<McpInitializeResult> {
    const message: McpMessage = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        },
        clientInfo: {
          name: 'nestjs-mcp-client',
          version: '1.0.0'
        }
      }
    };

    const result = await this.sendMessage(serverName, message);
    
    // Send initialized notification
    await this.sendNotification(serverName, 'notifications/initialized', {});
    
    return result;
  }

  async listTools(serverName: string): Promise<McpTool[]> {
    const message: McpMessage = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method: 'tools/list',
      params: {}
    };

    const result = await this.sendMessage(serverName, message);
    return result.tools || [];
  }

  async listResources(serverName: string): Promise<McpResource[]> {
    const message: McpMessage = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method: 'resources/list',
      params: {}
    };

    try {
      const result = await this.sendMessage(serverName, message);
      return result.resources || [];
    } catch (error) {
      // Some servers might not support resources
      this.logger.debug(`Server ${serverName} does not support resources: ${error.message}`);
      return [];
    }
  }

  async callTool(serverName: string, toolName: string, arguments_: any): Promise<any> {
    const message: McpMessage = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: arguments_
      }
    };

    const result = await this.sendMessage(serverName, message);
    return result;
  }

  async readResource(serverName: string, uri: string): Promise<any> {
    const message: McpMessage = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method: 'resources/read',
      params: {
        uri: uri
      }
    };

    const result = await this.sendMessage(serverName, message);
    return result;
  }

  private async sendMessage(serverName: string, message: McpMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      const process = this.servers.get(serverName);
      if (!process || !process.stdin) {
        reject(new Error(`MCP server ${serverName} not available`));
        return;
      }

      if (message.id) {
        this.pendingRequests.set(message.id, { resolve, reject });
        
        // Set timeout for request
        setTimeout(() => {
          if (this.pendingRequests.has(message.id!)) {
            this.pendingRequests.delete(message.id!);
            reject(new Error(`Request timeout for ${serverName}`));
          }
        }, 30000); // 30 second timeout
      }

      const messageStr = JSON.stringify(message) + '\n';
      process.stdin.write(messageStr);

      if (!message.id) {
        // Notification, resolve immediately
        resolve(null);
      }
    });
  }

  private async sendNotification(serverName: string, method: string, params: any): Promise<void> {
    const message: McpMessage = {
      jsonrpc: '2.0',
      method: method,
      params: params
    };

    await this.sendMessage(serverName, message);
  }

  private handleMessage(serverName: string, message: McpMessage): void {
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve, reject } = this.pendingRequests.get(message.id)!;
      this.pendingRequests.delete(message.id);

      if (message.error) {
        reject(new Error(`MCP Error: ${message.error.message || message.error}`));
      } else {
        resolve(message.result);
      }
    } else if (message.method) {
      // Handle notifications/requests from server
      this.logger.debug(`Received ${message.method} from ${serverName}:`, message.params);
    }
  }

  async stopServer(serverName: string): Promise<void> {
    const process = this.servers.get(serverName);
    if (process) {
      process.kill();
      this.servers.delete(serverName);
      this.logger.log(`Stopped MCP server: ${serverName}`);
    }
  }

  async stopAllServers(): Promise<void> {
    for (const [serverName] of this.servers) {
      await this.stopServer(serverName);
    }
  }

  private processIncomingData(serverName: string, data: string): void {
    // Get or initialize buffer for this server
    const currentBuffer = this.messageBuffers.get(serverName) || '';
    const newBuffer = currentBuffer + data;
    
    // Split by newlines to find complete messages
    const lines = newBuffer.split('\n');
    
    // Keep the last incomplete line in the buffer
    const incompleteMessage = lines.pop() || '';
    this.messageBuffers.set(serverName, incompleteMessage);
    
    // Process complete messages
    for (const line of lines) {
      if (line.trim()) {
        try {
          const message: McpMessage = JSON.parse(line);
          this.handleMessage(serverName, message);
        } catch (error) {
          this.logger.debug(`Failed to parse JSON message from ${serverName}: ${line}`);
          this.logger.debug(`Parse error: ${error.message}`);
          // Try to handle partial messages by keeping them in buffer
          const existingBuffer = this.messageBuffers.get(serverName) || '';
          this.messageBuffers.set(serverName, line + '\n' + existingBuffer);
        }
      }
    }
  }

  isServerRunning(serverName: string): boolean {
    return this.servers.has(serverName);
  }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { McpService, McpTool, McpToolCall } from './mcp.service';

export interface ProactiveMcpConfig {
  enabled: boolean;
  autoDiscovery: boolean;
  proactiveTools: {
    [serverName: string]: {
      enabled: boolean;
      keywords: string[];
      tools: {
        [toolName: string]: {
          priority: number;
          autoTrigger: boolean;
          keywords: string[];
          defaultArgs?: any;
        };
      };
    };
  };
}

@Injectable()
export class ProactiveMcpService implements OnModuleInit {
  private readonly logger = new Logger(ProactiveMcpService.name);
  private config: ProactiveMcpConfig;
  private toolsIndex: Map<string, { serverName: string; toolName: string; tool: McpTool }> = new Map();

  constructor(private mcpService: McpService) {
    this.initializeConfig();
  }

  async onModuleInit() {
    if (this.config.enabled && this.config.autoDiscovery) {
      // Delay the tools index building to allow MCP servers to fully initialize
      setTimeout(async () => {
        await this.buildToolsIndex();
      }, 5000); // Wait 5 seconds for MCP servers to be ready
    }
  }

  private initializeConfig() {
    this.config = {
      enabled: true,
      autoDiscovery: true,
      proactiveTools: {
        'mcp-abap-abap-adt-api': {
          enabled: true,
          keywords: ['sap', 'abap', 'adt', 'table', 'vbak', 'vbrk', 'class', 'object', 'source', 'code', 'rechnung', 'invoice', 'belege', 'documents'],
          tools: {
            'tableContents': {
              priority: 10,
              autoTrigger: true,
              keywords: ['table', 'vbak', 'vbrk', 'tabelle', 'inhalt', 'contents', 'daten', 'data', 'einträge', 'entries', 'rechnung', 'rechnungen', 'invoice', 'invoices', 'belege', 'documents'],
              defaultArgs: { rowNumber: 10 }
            },
            'searchObject': {
              priority: 8,
              autoTrigger: true,
              keywords: ['search', 'suche', 'find', 'object', 'objekt'],
              defaultArgs: { max: 10 }
            },
            'classComponents': {
              priority: 7,
              autoTrigger: true,
              keywords: ['class', 'klasse', 'component', 'komponente', 'method', 'methode'],
              defaultArgs: {}
            },
            'getObjectSource': {
              priority: 6,
              autoTrigger: true,
              keywords: ['source', 'code', 'quellcode', 'program', 'programm'],
              defaultArgs: {}
            },
            'objectStructure': {
              priority: 5,
              autoTrigger: true,
              keywords: ['structure', 'struktur', 'schema', 'definition'],
              defaultArgs: {}
            }
          }
        },
        'document-retrieval': {
          enabled: true,
          keywords: ['document', 'dokument', 'documents', 'dokumente', 'file', 'datei', 'files', 'dateien', 'search', 'suche', 'find', 'finde', 'content', 'inhalt', 'text', 'kostenbescheid', 'rechnung', 'invoice', 'pilot', 'ausbildung', 'training', 'certificate', 'zertifikat'],
          tools: {
            'search_documents': {
              priority: 10,
              autoTrigger: true,
              keywords: ['search', 'suche', 'find', 'finde', 'document', 'dokument', 'documents', 'dokumente', 'file', 'datei', 'files', 'dateien', 'content', 'inhalt', 'kostenbescheid', 'rechnung', 'invoice', 'pilot', 'ausbildung', 'training', 'certificate', 'zertifikat', 'bezahlt', 'paid', 'kosten', 'cost', 'betrag', 'amount'],
              defaultArgs: { limit: 10, threshold: 0.3 }
            },
            'get_document_context': {
              priority: 9,
              autoTrigger: true,
              keywords: ['context', 'kontext', 'relevant', 'information', 'info', 'details'],
              defaultArgs: { maxChunks: 5, threshold: 0.3 }
            },
            'get_document_stats': {
              priority: 5,
              autoTrigger: true,
              keywords: ['stats', 'statistics', 'statistik', 'overview', 'überblick', 'summary', 'zusammenfassung'],
              defaultArgs: {}
            },
            'index_document': {
              priority: 3,
              autoTrigger: false,
              keywords: ['index', 'indexieren', 'add', 'hinzufügen', 'upload'],
              defaultArgs: {}
            },
            'test_embedding_service': {
              priority: 2,
              autoTrigger: false,
              keywords: ['test', 'embedding', 'service', 'connection'],
              defaultArgs: {}
            }
          }
        },
        'agentdb': {
          enabled: true,
          keywords: ['agentdb', 'cache', 'database', 'datenbank', 'sql', 'query'],
          tools: {
            'natural_language_query': {
              priority: 10,
              autoTrigger: true,
              keywords: ['query', 'abfrage', 'search', 'suche', 'find', 'count', 'anzahl'],
              defaultArgs: {
                token: 'acd22c69-e92c-44e2-92b4-720b8f70426e',
                dbName: 'SAP_ODATA_CACHE',
                dbType: 'sqlite'
              }
            },
            'list_databases': {
              priority: 8,
              autoTrigger: true,
              keywords: ['database', 'datenbank', 'list', 'liste', 'show', 'zeige'],
              defaultArgs: {
                token: 'acd22c69-e92c-44e2-92b4-720b8f70426e'
              }
            },
            'execute_sql': {
              priority: 6,
              autoTrigger: false,
              keywords: ['sql', 'execute', 'run', 'ausführen'],
              defaultArgs: {
                token: 'acd22c69-e92c-44e2-92b4-720b8f70426e',
                dbName: 'SAP_ODATA_CACHE',
                dbType: 'sqlite'
              }
            }
          }
        }
      }
    };
  }

  private async buildToolsIndex() {
    this.logger.log('Building proactive MCP tools index...');
    
    const availableServers = await this.mcpService.getAvailableServers();
    
    for (const server of availableServers) {
      try {
        const tools = await this.mcpService.getAvailableTools(server.name);
        
        for (const tool of tools) {
          const key = `${server.name}.${tool.name}`;
          this.toolsIndex.set(key, {
            serverName: server.name,
            toolName: tool.name,
            tool
          });
          
          // Also index by tool name only for quick lookup
          this.toolsIndex.set(tool.name, {
            serverName: server.name,
            toolName: tool.name,
            tool
          });
        }
        
        this.logger.log(`Indexed ${tools.length} tools for server: ${server.name}`);
      } catch (error) {
        this.logger.error(`Failed to index tools for server ${server.name}: ${error.message}`);
      }
    }
    
    this.logger.log(`Built tools index with ${this.toolsIndex.size} entries`);
  }

  /**
   * Proactively analyze user input and suggest/execute MCP tools
   */
  async analyzeAndExecuteProactiveTools(
    userInput: string,
    activeServers: string[],
    autoExecute: boolean = true,
    authToken?: string
  ): Promise<{ toolCall: McpToolCall; result: any }[]> {
    if (!this.config.enabled) {
      return [];
    }

    const results: { toolCall: McpToolCall; result: any }[] = [];
    const inputLower = userInput.toLowerCase();
    
    // Find matching tools based on keywords and priority
    const matchingTools = this.findMatchingTools(inputLower, activeServers);
    
    if (matchingTools.length === 0) {
      this.logger.debug('No matching proactive tools found for input');
      return [];
    }

    // Sort by priority (higher priority first)
    matchingTools.sort((a, b) => b.priority - a.priority);
    
    // Execute the highest priority tool(s)
    for (const match of matchingTools.slice(0, 2)) { // Limit to top 2 tools
      if (!autoExecute && !match.autoTrigger) {
        continue;
      }

      try {
        const toolCall = this.buildToolCall(match, userInput);
        this.logger.log(`Proactively executing: ${toolCall.serverName}.${toolCall.toolName}`);
        
        const result = await this.mcpService.executeTool(toolCall, authToken);
        results.push({ toolCall, result });
        
        // If we got a successful result, we might not need to execute more tools
        if (result.success && match.priority >= 8) {
          break;
        }
      } catch (error) {
        this.logger.error(`Proactive tool execution failed: ${error.message}`);
      }
    }

    return results;
  }

  private findMatchingTools(inputLower: string, activeServers: string[]): Array<{
    serverName: string;
    toolName: string;
    tool: McpTool;
    priority: number;
    autoTrigger: boolean;
    defaultArgs: any;
  }> {
    const matches: Array<{
      serverName: string;
      toolName: string;
      tool: McpTool;
      priority: number;
      autoTrigger: boolean;
      defaultArgs: any;
    }> = [];

    for (const [serverName, serverConfig] of Object.entries(this.config.proactiveTools)) {
      if (!serverConfig.enabled || !activeServers.includes(serverName)) {
        continue;
      }

      // Check if any server keywords match
      const serverKeywordMatch = serverConfig.keywords.some(keyword => 
        inputLower.includes(keyword.toLowerCase())
      );

      if (!serverKeywordMatch) {
        continue;
      }

      // Check individual tools
      for (const [toolName, toolConfig] of Object.entries(serverConfig.tools)) {
        const toolKeywordMatch = toolConfig.keywords.some(keyword => 
          inputLower.includes(keyword.toLowerCase())
        );

        if (toolKeywordMatch) {
          const toolEntry = this.toolsIndex.get(`${serverName}.${toolName}`);
          if (toolEntry) {
            matches.push({
              serverName,
              toolName,
              tool: toolEntry.tool,
              priority: toolConfig.priority,
              autoTrigger: toolConfig.autoTrigger,
              defaultArgs: toolConfig.defaultArgs || {}
            });
          }
        }
      }
    }

    return matches;
  }

  private buildToolCall(match: {
    serverName: string;
    toolName: string;
    tool: McpTool;
    priority: number;
    autoTrigger: boolean;
    defaultArgs: any;
  }, userInput: string): McpToolCall {
    const args = { ...match.defaultArgs };

    // Smart argument extraction based on tool type
    if (match.toolName === 'tableContents') {
      // Extract table name from input
      const tableMatch = userInput.match(/\b([A-Z]{3,8})\b/);
      if (tableMatch) {
        args.ddicEntityName = tableMatch[1];
      } else if (userInput.toLowerCase().includes('vbak')) {
        args.ddicEntityName = 'VBAK';
      } else if (userInput.toLowerCase().includes('rechnung') || userInput.toLowerCase().includes('invoice')) {
        args.ddicEntityName = 'VBRK'; // Rechnungsköpfe
      } else if (userInput.toLowerCase().includes('vbrk')) {
        args.ddicEntityName = 'VBRK';
      }

      // Extract row count
      const rowMatch = userInput.match(/(\d+)\s*(einträge|entries|rows|zeilen)/i);
      if (rowMatch) {
        args.rowNumber = parseInt(rowMatch[1]);
      }
    } else if (match.toolName === 'searchObject') {
      // Extract search query
      const queryMatch = userInput.match(/(?:search|suche|find)\s+(?:for\s+)?([a-zA-Z0-9_]+)/i);
      if (queryMatch) {
        args.query = queryMatch[1];
      } else {
        args.query = 'VBAK'; // Default fallback
      }
    } else if (match.toolName === 'search_documents') {
      // Extract search query from user input for document search
      const searchTerms = this.extractDocumentSearchTerms(userInput);
      args.query = searchTerms;
    } else if (match.toolName === 'get_document_context') {
      // Extract context query from user input
      const searchTerms = this.extractDocumentSearchTerms(userInput);
      args.query = searchTerms;
    } else if (match.toolName === 'natural_language_query') {
      // Use the full user input as natural language query
      args.query = userInput;
    }

    return {
      serverName: match.serverName,
      toolName: match.toolName,
      arguments: args
    };
  }

  /**
   * Get available proactive tools for a server
   */
  getProactiveToolsForServer(serverName: string): string[] {
    const serverConfig = this.config.proactiveTools[serverName];
    if (!serverConfig || !serverConfig.enabled) {
      return [];
    }

    return Object.keys(serverConfig.tools);
  }

  /**
   * Check if a tool should be auto-triggered
   */
  shouldAutoTrigger(serverName: string, toolName: string): boolean {
    const serverConfig = this.config.proactiveTools[serverName];
    if (!serverConfig || !serverConfig.enabled) {
      return false;
    }

    const toolConfig = serverConfig.tools[toolName];
    return toolConfig ? toolConfig.autoTrigger : false;
  }

  /**
   * Update proactive configuration
   */
  updateConfig(newConfig: Partial<ProactiveMcpConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.logger.log('Proactive MCP configuration updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): ProactiveMcpConfig {
    return { ...this.config };
  }

  /**
   * Extract search terms from user input for document search
   */
  private extractDocumentSearchTerms(userInput: string): string {
    const inputLower = userInput.toLowerCase();
    
    // Look for specific search terms after keywords - improved patterns
    const searchPatterns = [
      // German patterns
      /begriff\s+["']?([^"'?\s]+)["']?\s*(?:vor|enthalten|kommt)/i,
      /term\s+["']?([^"'?\s]+)["']?\s*(?:appears|contains)/i,
      /enthalten\s+den\s+begriff\s+["']?([^"'?\s]+)["']?/i,
      /contain\s+the\s+term\s+["']?([^"'?\s]+)["']?/i,
      /nach\s+["']?([^"'?\s]+)["']?\s*(?:suche|durchsuche|finde)/i,
      /für\s+["']?([^"'?\s]+)["']?\s*(?:suche|durchsuche|finde)/i,
      /über\s+["']?([^"'?\s]+)["']?\s*(?:suche|durchsuche|finde)/i,
      /mit\s+["']?([^"'?\s]+)["']?\s*(?:suche|durchsuche|finde)/i,
      /["']([^"'?\s]+)["']\s*(?:vor|enthalten|appears|contains)/i,
      /kommt\s+der\s+begriff\s+["']?([A-Z0-9]+)["']?\s+vor/i,
      /contains?\s+the\s+term\s+["']?([A-Z0-9]+)["']?/i,
      // Direct quoted terms
      /["']([A-Z0-9]{2,})["']/i,
      // Uppercase terms (likely technical terms)
      /\b([A-Z]{3,})\b/,
      // Specific document-related terms
      /kostenbescheid|pilot|ausbildung|training|certificate|zertifikat|rechnung|invoice/i,
    ];

    for (const pattern of searchPatterns) {
      const match = userInput.match(pattern);
      if (match && match[1] && match[1].length > 1) {
        return match[1].trim();
      }
    }

    // If no specific pattern found, extract potential search terms from the input
    const words = userInput.split(/\s+/);
    const searchWords = words.filter(word => {
      const cleanWord = word.replace(/['"?!.,;:]/g, '');
      return cleanWord.length > 2 && 
        !['der', 'die', 'das', 'und', 'oder', 'mit', 'für', 'von', 'zu', 'in', 'auf', 'an', 'bei', 'nach', 'über', 'unter', 'vor', 'zwischen', 'durch', 'gegen', 'ohne', 'um', 'the', 'and', 'or', 'with', 'for', 'from', 'to', 'in', 'on', 'at', 'by', 'after', 'over', 'under', 'before', 'between', 'through', 'against', 'without', 'around', 'welchen', 'welche', 'meiner', 'meinen', 'dokumente', 'documents', 'kommt', 'enthalten', 'contains', 'search', 'find', 'suche', 'finde'].includes(cleanWord.toLowerCase()) &&
        !/^(ist|sind|war|waren|hat|haben|wird|werden|kann|können|soll|sollen|muss|müssen)$/i.test(cleanWord);
    });

    // Prefer uppercase words (technical terms) or longer words
    const technicalTerms = searchWords.filter(word => /^[A-Z]{2,}$/.test(word.replace(/['"?!.,;:]/g, '')));
    if (technicalTerms.length > 0) {
      return technicalTerms[0].replace(/['"?!.,;:]/g, '');
    }

    return searchWords.slice(0, 2).join(' ') || 'documents';
  }

  /**
   * Refresh tools index
   */
  async refreshToolsIndex() {
    this.toolsIndex.clear();
    await this.buildToolsIndex();
  }
}

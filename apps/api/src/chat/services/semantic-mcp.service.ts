import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { McpService, McpTool, McpToolCall } from './mcp.service';

export interface SemanticMapping {
  concepts: string[];
  tables: string[];
  operations: string[];
  priority: number;
}

export interface SemanticMcpConfig {
  enabled: boolean;
  semanticMappings: {
    [domain: string]: SemanticMapping;
  };
  fallbackBehavior: 'ask_user' | 'search_all' | 'use_default';
}

@Injectable()
export class SemanticMcpService implements OnModuleInit {
  private readonly logger = new Logger(SemanticMcpService.name);
  private config: SemanticMcpConfig;
  private toolsIndex: Map<string, { serverName: string; toolName: string; tool: McpTool }> = new Map();
  private conceptToTableMap: Map<string, string[]> = new Map();

  constructor(private mcpService: McpService) {
    this.initializeSemanticConfig();
  }

  async onModuleInit() {
    if (this.config.enabled) {
      // Delay semantic index building to allow MCP servers to start
      setTimeout(async () => {
        await this.buildSemanticIndex();
      }, 5000); // Wait 5 seconds for MCP servers to be ready
    }
  }

  private initializeSemanticConfig() {
    this.config = {
      enabled: true,
      semanticMappings: {
        'sales': {
          concepts: ['auftrag', 'aufträge', 'order', 'orders', 'verkauf', 'sales', 'bestellung', 'bestellungen'],
          tables: ['VBAK', 'VBAP', 'VBKD'],
          operations: ['tableContents', 'searchObject'],
          priority: 10
        },
        'invoicing': {
          concepts: ['rechnung', 'rechnungen', 'invoice', 'invoices', 'faktura', 'billing', 'abrechnung'],
          tables: ['VBRK', 'VBRP', 'VBFA'],
          operations: ['tableContents', 'searchObject'],
          priority: 10
        },
        'customers': {
          concepts: ['kunde', 'kunden', 'customer', 'customers', 'debitor', 'debitoren', 'geschäftspartner'],
          tables: ['KNA1', 'KNB1', 'KNVV'],
          operations: ['tableContents', 'searchObject'],
          priority: 9
        },
        'materials': {
          concepts: ['material', 'materialien', 'artikel', 'produkt', 'produkte', 'item', 'items'],
          tables: ['MARA', 'MARC', 'MARD'],
          operations: ['tableContents', 'searchObject'],
          priority: 8
        },
        'purchasing': {
          concepts: ['einkauf', 'purchase', 'purchasing', 'beschaffung', 'lieferant', 'lieferanten', 'vendor', 'vendors'],
          tables: ['EKKO', 'EKPO', 'LFA1'],
          operations: ['tableContents', 'searchObject'],
          priority: 8
        },
        'finance': {
          concepts: ['finanzen', 'finance', 'buchhaltung', 'accounting', 'buchung', 'buchungen', 'beleg', 'belege'],
          tables: ['BKPF', 'BSEG', 'FAGLFLEXA'],
          operations: ['tableContents', 'searchObject'],
          priority: 7
        },
        'documents': {
          concepts: ['dokument', 'dokumente', 'document', 'documents', 'datei', 'dateien', 'file', 'files', 'suche', 'search', 'finde', 'find', 'durchsuche', 'durchsuchen', 'inhalt', 'content', 'text', 'begriffe', 'begriff', 'term', 'terms', 'wo', 'where', 'welche', 'which', 'enthalten', 'contains', 'kommt vor', 'appears', 'meiner', 'meinen', 'meine', 'my', 'in welchen', 'which of my'],
          tables: [],
          operations: ['search_documents', 'get_document_context', 'get_document_stats'],
          priority: 10
        }
      },
      fallbackBehavior: 'search_all'
    };
  }

  private async buildSemanticIndex() {
    this.logger.log('Building semantic MCP index...');
    
    // Build concept to table mapping
    for (const [domain, mapping] of Object.entries(this.config.semanticMappings)) {
      for (const concept of mapping.concepts) {
        const existingTables = this.conceptToTableMap.get(concept.toLowerCase()) || [];
        this.conceptToTableMap.set(concept.toLowerCase(), [...existingTables, ...mapping.tables]);
      }
    }

    // Build tools index
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
        }
        
        this.logger.log(`Indexed ${tools.length} tools for server: ${server.name}`);
      } catch (error) {
        this.logger.error(`Failed to index tools for server ${server.name}: ${error.message}`);
      }
    }
    
    this.logger.log(`Built semantic index with ${this.conceptToTableMap.size} concept mappings`);
  }

  /**
   * Semantically analyze user input and execute appropriate MCP tools
   */
  async analyzeAndExecuteSemanticTools(
    userInput: string,
    activeServers: string[],
    autoExecute: boolean = true,
    authToken?: string,
    conversationHistory?: string[]
  ): Promise<{ toolCall: McpToolCall; result: any }[]> {
    if (!this.config.enabled) {
      return [];
    }

    const results: { toolCall: McpToolCall; result: any }[] = [];
    
    // Combine current input with recent conversation history for context
    let contextualInput = userInput;
    if (conversationHistory && conversationHistory.length > 0) {
      // Include the last 3 messages for context
      const recentHistory = conversationHistory.slice(-3).join(' ');
      contextualInput = `${recentHistory} ${userInput}`;
      this.logger.debug(`Using contextual input: "${contextualInput.substring(0, 100)}..."`);
    }
    
    const inputLower = contextualInput.toLowerCase();
    
    // Extract semantic information from user input with context
    const semanticAnalysis = this.analyzeUserIntent(inputLower);
    
    if (!semanticAnalysis.tables.length && !semanticAnalysis.operations.some(op => ['search_documents', 'get_document_context', 'get_document_stats'].includes(op))) {
      this.logger.debug('No semantic tables or document operations found for input');
      return [];
    }

    // Find the best matching tool
    const bestTool = this.findBestTool(semanticAnalysis, activeServers);
    
    if (!bestTool) {
      this.logger.debug('No suitable tool found for semantic analysis');
      return [];
    }

    try {
      const toolCall = this.buildSemanticToolCall(bestTool, semanticAnalysis, userInput);
      this.logger.log(`Semantically executing: ${toolCall.serverName}.${toolCall.toolName} for table ${toolCall.arguments.ddicEntityName}`);
      
      const result = await this.mcpService.executeTool(toolCall, authToken);
      results.push({ toolCall, result });
      
    } catch (error) {
      this.logger.error(`Semantic tool execution failed: ${error.message}`);
    }

    return results;
  }

  private analyzeUserIntent(inputLower: string): {
    concepts: string[];
    tables: string[];
    operations: string[];
    priority: number;
    rowCount?: number;
  } {
    const analysis = {
      concepts: [] as string[],
      tables: [] as string[],
      operations: ['tableContents'], // Default operation
      priority: 0,
      rowCount: this.extractRowCount(inputLower)
    };

    // Find matching concepts and their associated tables
    for (const [concept, tables] of this.conceptToTableMap.entries()) {
      if (inputLower.includes(concept)) {
        analysis.concepts.push(concept);
        analysis.tables.push(...tables);
      }
    }

    // Remove duplicates and prioritize
    analysis.tables = [...new Set(analysis.tables)];
    
    // Determine priority based on matched domains
    for (const [domain, mapping] of Object.entries(this.config.semanticMappings)) {
      const hasMatchingConcept = mapping.concepts.some(concept => 
        inputLower.includes(concept.toLowerCase())
      );
      
      if (hasMatchingConcept) {
        analysis.priority = Math.max(analysis.priority, mapping.priority);
        
        // Add domain-specific operations
        analysis.operations = [...new Set([...analysis.operations, ...mapping.operations])];
      }
    }

    // If no specific tables found, try to extract table names directly
    if (analysis.tables.length === 0) {
      const tableMatch = inputLower.match(/\b([A-Z]{3,8})\b/g);
      if (tableMatch) {
        analysis.tables = tableMatch;
        analysis.priority = 5; // Medium priority for direct table references
      }
    }

    return analysis;
  }

  private extractRowCount(inputLower: string): number {
    // Extract number from phrases like "ersten 10", "first 5", "10 einträge", etc.
    const patterns = [
      /ersten?\s+(\d+)/,
      /first\s+(\d+)/,
      /(\d+)\s*(einträge|entries|rows|zeilen|belege|documents)/,
      /top\s+(\d+)/,
      /limit\s+(\d+)/
    ];

    for (const pattern of patterns) {
      const match = inputLower.match(pattern);
      if (match) {
        return parseInt(match[1]);
      }
    }

    return 10; // Default
  }

  private findBestTool(
    analysis: { concepts: string[]; tables: string[]; operations: string[]; priority: number },
    activeServers: string[]
  ): { serverName: string; toolName: string; tool: McpTool } | null {
    // Prioritize document operations first, then SAP operations
    const operationPriority = ['search_documents', 'get_document_context', 'get_document_stats', 'tableContents', 'searchObject', 'objectStructure'];
    
    for (const operation of operationPriority) {
      if (analysis.operations.includes(operation)) {
        for (const serverName of activeServers) {
          const toolKey = `${serverName}.${operation}`;
          const tool = this.toolsIndex.get(toolKey);
          if (tool) {
            return tool;
          }
        }
      }
    }

    return null;
  }

  private buildSemanticToolCall(
    tool: { serverName: string; toolName: string; tool: McpTool },
    analysis: { concepts: string[]; tables: string[]; operations: string[]; priority: number; rowCount?: number },
    userInput: string
  ): McpToolCall {
    const args: any = {};

    if (tool.toolName === 'search_documents') {
      // Extract search query from user input
      const searchQuery = this.extractSearchQuery(userInput, analysis.concepts);
      args.query = searchQuery;
      args.limit = analysis.rowCount || 10;
      args.threshold = 0.1; // Much lower threshold for broader search
    } else if (tool.toolName === 'get_document_context') {
      // Extract search query from user input
      const searchQuery = this.extractSearchQuery(userInput, analysis.concepts);
      args.query = searchQuery;
      args.maxChunks = analysis.rowCount || 5;
      args.threshold = 0.3;
    } else if (tool.toolName === 'get_document_stats') {
      // No arguments needed for stats
    } else if (tool.toolName === 'tableContents') {
      // Choose the most relevant table (first one for now, could be improved with ML)
      args.ddicEntityName = analysis.tables[0];
      args.rowNumber = analysis.rowCount || 10;
    } else if (tool.toolName === 'searchObject') {
      // Use the first concept or table as search query
      args.query = analysis.concepts[0] || analysis.tables[0] || 'VBAK';
      args.max = analysis.rowCount || 10;
    } else if (tool.toolName === 'objectStructure') {
      args.objectName = analysis.tables[0];
      args.objectType = 'TABLE';
    }

    return {
      serverName: tool.serverName,
      toolName: tool.toolName,
      arguments: args
    };
  }

  private extractSearchQuery(userInput: string, concepts: string[]): string {
    // Priority 1: Look for quoted text (highest priority)
    const quotedMatch = userInput.match(/["']([^"']+)["']/);
    if (quotedMatch && quotedMatch[1]) {
      const quoted = quotedMatch[1].trim();
      // Make sure it's not a document-related stop word
      if (!['dokument', 'dokumente', 'document', 'documents', 'datei', 'dateien', 'file', 'files'].includes(quoted.toLowerCase())) {
        return quoted;
      }
    }

    // Priority 2: Look for specific search patterns
    const searchPatterns = [
      // Handle "nach X nach Y" pattern - take the LAST "nach" term
      /.*nach\s+["']?([A-ZÄÖÜ][a-zäöüß]+)["']?\s*$/i,
      // Handle "nach X in/suche/durchsuche/finde"
      /nach\s+["']?([^"'\s]+)["']?\s+(?:in|suche|durchsuche|finde)/i,
      // Handle "suche nach X"
      /such(?:e|en)?\s+(?:nach\s+)?["']?([^"'\s]+)["']?(?:\s+in)?/i,
      // Handle "finde X"
      /find(?:e|en)?\s+["']?([^"'\s]+)["']?/i,
      // Handle "for X"
      /for\s+["']?([^"'\s]+)["']?/i,
      // Handle "wo kommt X vor"
      /wo\s+kommt\s+(?:der\s+begriff\s+)?["']?([^"'\s]+)["']?\s+vor/i,
      // Handle "kommt der begriff X vor"
      /kommt\s+der\s+begriff\s+["']?([^"'\s]+)["']?\s+vor/i,
      // Handle "begriff X"
      /begriff\s+["']?([^"'\s]+)["']?\s*(?:vor|enthalten)/i,
      // Handle "contains X"
      /contains?\s+(?:the\s+)?(?:term\s+)?["']?([^"'\s]+)["']?/i,
    ];

    for (const pattern of searchPatterns) {
      const match = userInput.match(pattern);
      if (match && match[1]) {
        const term = match[1].trim();
        // Exclude common document-related stop words
        if (!['dokument', 'dokumente', 'document', 'documents', 'datei', 'dateien', 'file', 'files', 'meinen', 'meiner', 'meine', 'my'].includes(term.toLowerCase())) {
          return term;
        }
      }
    }

    // Priority 3: Extract capitalized words (likely proper nouns/names) from the contextual input
    // This helps when user says "try again" - we look for names mentioned earlier
    const capitalizedWords = userInput.match(/\b[A-ZÄÖÜ][a-zäöüß]+\b/g);
    if (capitalizedWords && capitalizedWords.length > 0) {
      // Filter out common German/English words that are capitalized AND command words
      const commonCapitalized = new Set(['Das', 'Die', 'Der', 'Ein', 'Eine', 'Einen', 'This', 'The', 'That', 'These', 'Those', 'Sie', 'Ihr', 'Ihre', 'Ihren', 'Ich', 'Habe', 'Kann', 'Möchte', 'Please', 'Bitte', 'Zeige', 'Suche', 'Finde', 'Stelle', 'Dokument', 'Dokumenten', 'Ok', 'Also', 'Und', 'Aber', 'Jetzt', 'Dann', 'Noch', 'Mal', 'Nochmal', 'Wieder']);
      const properNouns = capitalizedWords.filter(word => 
        !commonCapitalized.has(word) && 
        word.length > 2
      );
      
      if (properNouns.length > 0) {
        // Prefer names that appear multiple times or later in the text (more likely to be what user is asking about)
        const lastProperNoun = properNouns[properNouns.length - 1];
        this.logger.debug(`Found proper noun in context: ${lastProperNoun}`);
        return lastProperNoun;
      }
    }

    // Priority 4: If concepts exist, filter out document-related ones
    if (concepts.length > 0) {
      const filteredConcepts = concepts.filter(c => 
        !['dokument', 'dokumente', 'document', 'documents', 'datei', 'dateien', 'file', 'files', 'suche', 'search', 'finde', 'find'].includes(c.toLowerCase())
      );
      if (filteredConcepts.length > 0) {
        return filteredConcepts[0];
      }
    }

    // Priority 5: Extract meaningful words from input
    const inputLower = userInput.toLowerCase();
    const words = inputLower.split(/\s+/);
    const stopWords = new Set(['der', 'die', 'das', 'und', 'oder', 'mit', 'für', 'von', 'zu', 'in', 'auf', 'an', 'bei', 'nach', 'über', 'unter', 'vor', 'zwischen', 'durch', 'gegen', 'ohne', 'um', 'the', 'and', 'or', 'with', 'for', 'from', 'to', 'in', 'on', 'at', 'by', 'after', 'over', 'under', 'before', 'between', 'through', 'against', 'without', 'around', 'welchen', 'meiner', 'meinem', 'meine', 'dokumente', 'dokument', 'documents', 'document', 'kommt', 'enthalten', 'bitte', 'please', 'suche', 'search', 'finde', 'find', 'durchsuche', 'noch', 'einmal', 'nochmal', 'again', 'versuche', 'try', 'es']);
    
    const searchWords = words.filter(word => 
      word.length > 2 && 
      !stopWords.has(word) &&
      !/^\d+$/.test(word) // Exclude pure numbers
    );

    return searchWords.slice(0, 2).join(' ') || 'content';
  }

  /**
   * Add new semantic mapping dynamically
   */
  addSemanticMapping(domain: string, mapping: SemanticMapping): void {
    this.config.semanticMappings[domain] = mapping;
    
    // Update concept to table mapping
    for (const concept of mapping.concepts) {
      const existingTables = this.conceptToTableMap.get(concept.toLowerCase()) || [];
      this.conceptToTableMap.set(concept.toLowerCase(), [...existingTables, ...mapping.tables]);
    }
    
    this.logger.log(`Added semantic mapping for domain: ${domain}`);
  }

  /**
   * Get semantic analysis for debugging
   */
  analyzeUserInputDebug(userInput: string): any {
    return this.analyzeUserIntent(userInput.toLowerCase());
  }

  /**
   * Get current semantic configuration
   */
  getSemanticConfig(): SemanticMcpConfig {
    return { ...this.config };
  }

  /**
   * Update semantic configuration
   */
  updateSemanticConfig(newConfig: Partial<SemanticMcpConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.log('Semantic MCP configuration updated');
  }
}

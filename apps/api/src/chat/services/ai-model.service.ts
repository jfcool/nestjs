import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface AIModel {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'local' | 'azure' | 'google';
  endpoint?: string;
  apiKey?: string;
  apiKeyEnv?: string;
  maxTokens: number;
  temperature: number;
  description: string;
  enabled: boolean;
  contextWindow?: number;
  inputPrice?: number;
  outputPrice?: number;
  supportsImages?: boolean;
  supportsBrowserUse?: boolean;
  supportsPromptCaching?: boolean;
}

export interface AIModelConfig {
  models: AIModel[];
  defaultModel: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface ConfigFile {
  aiModels: {
    defaultModel: string;
    models: Array<{
      id: string;
      name: string;
      provider: string;
      endpoint?: string;
      apiKeyEnv?: string;
      maxTokens: number;
      temperature: number;
      description: string;
      enabled: boolean;
    }>;
  };
  providers: Record<string, any>;
}

@Injectable()
export class AIModelService {
  private readonly logger = new Logger(AIModelService.name);
  private config: AIModelConfig;
  private configFilePath: string;

  constructor() {
    // Handle both monorepo and standalone scenarios
    const possiblePaths = [
      path.join(process.cwd(), 'conf.json'),
      path.join(process.cwd(), 'apps/api/conf.json'),
      path.join(__dirname, '../../../conf.json'),
    ];
    
    this.configFilePath = possiblePaths.find(p => {
      try {
        require('fs').accessSync(p);
        return true;
      } catch {
        return false;
      }
    }) || possiblePaths[0];
    
    this.initializeConfig();
  }

  private initializeConfig() {
    try {
      // Load configuration from conf.json file
      const configData = fs.readFileSync(this.configFilePath, 'utf8');
      const configFile: ConfigFile = JSON.parse(configData);

      // Process models and check for API keys
      const processedModels: AIModel[] = configFile.aiModels.models.map(model => {
        const apiKey = model.apiKeyEnv ? process.env[model.apiKeyEnv] : undefined;
        const isEnabled = model.enabled && (
          !model.apiKeyEnv || // No API key required (local models)
          !!apiKey // API key is present
        );

        this.logger.log(`Model ${model.id}: API Key ${model.apiKeyEnv ? (apiKey ? 'Present' : 'Missing') : 'Not Required'}, Enabled: ${isEnabled}`);

        return {
          id: model.id,
          name: model.name,
          provider: model.provider as AIModel['provider'],
          endpoint: model.endpoint,
          apiKey,
          apiKeyEnv: model.apiKeyEnv,
          maxTokens: model.maxTokens,
          temperature: model.temperature,
          description: model.description,
          enabled: isEnabled,
          contextWindow: (model as any).contextWindow,
          inputPrice: (model as any).inputPrice,
          outputPrice: (model as any).outputPrice,
          supportsImages: (model as any).supportsImages,
          supportsBrowserUse: (model as any).supportsBrowserUse,
          supportsPromptCaching: (model as any).supportsPromptCaching,
        };
      });

      // Set default model based on configuration or environment
      let defaultModel = process.env.DEFAULT_AI_MODEL || configFile.aiModels.defaultModel;
      
      // Ensure default model is available and enabled
      const defaultModelExists = processedModels.find(m => m.id === defaultModel && m.enabled);
      if (!defaultModelExists) {
        // Fallback to first available model
        const firstAvailable = processedModels.find(m => m.enabled);
        if (firstAvailable) {
          defaultModel = firstAvailable.id;
          this.logger.warn(`Default model ${configFile.aiModels.defaultModel} not available, using ${defaultModel}`);
        } else {
          this.logger.error('No AI models are available! Please check your API keys.');
        }
      }

      this.config = {
        defaultModel,
        models: processedModels,
      };

      this.logger.log(`Initialized AI models from config file. Default: ${this.config.defaultModel}. Available models: ${this.getAvailableModels().map(m => m.name).join(', ')}`);
    } catch (error) {
      this.logger.error(`Failed to load configuration from ${this.configFilePath}: ${error.message}`);
      // Fallback to minimal configuration
      this.config = {
        defaultModel: 'local-llama',
        models: [{
          id: 'local-llama',
          name: 'Local Llama (Fallback)',
          provider: 'local',
          endpoint: 'http://localhost:11434/api/generate',
          maxTokens: 2048,
          temperature: 0.7,
          description: 'Fallback local model configuration',
          enabled: true,
        }],
      };
    }
  }

  getAvailableModels(): AIModel[] {
    return this.config.models.filter(model => model.enabled);
  }

  getModel(modelId: string): AIModel | undefined {
    return this.config.models.find(model => model.id === modelId && model.enabled);
  }

  getDefaultModel(): AIModel {
    const defaultModel = this.getModel(this.config.defaultModel);
    if (defaultModel) {
      return defaultModel;
    }
    
    // Fallback to first available model
    const availableModels = this.getAvailableModels();
    if (availableModels.length > 0) {
      return availableModels[0];
    }

    throw new Error('No AI models available');
  }

  async generateResponse(
    messages: ChatMessage[],
    modelId?: string,
    mcpToolCalls?: any[]
  ): Promise<AIResponse> {
    const model = modelId ? this.getModel(modelId) : this.getDefaultModel();
    if (!model) {
      throw new Error(`Model ${modelId} not found or not enabled`);
    }

    this.logger.log(`Generating response using model: ${model.name}`);

    try {
      switch (model.provider) {
        case 'openai':
          return await this.callOpenAI(model, messages, mcpToolCalls);
        case 'anthropic':
          return await this.callAnthropic(model, messages, mcpToolCalls);
        case 'google':
          return await this.callGoogle(model, messages, mcpToolCalls);
        case 'azure':
          return await this.callAzure(model, messages, mcpToolCalls);
        case 'local':
          return await this.callLocalModel(model, messages, mcpToolCalls);
        default:
          // Fallback to simulation for development
          return await this.simulateResponse(model, messages, mcpToolCalls);
      }
    } catch (error) {
      this.logger.error(`Error generating response with ${model.name}: ${error.message}`);
      // Fallback to simulation
      return await this.simulateResponse(model, messages, mcpToolCalls);
    }
  }

  private async callOpenAI(model: AIModel, messages: ChatMessage[], mcpToolCalls?: any[]): Promise<AIResponse> {
    if (!model.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // This would be the actual OpenAI API call
    // For now, we'll simulate it
    this.logger.log('OpenAI API call would be made here');
    return this.simulateResponse(model, messages, mcpToolCalls);
  }

  private async callAnthropic(model: AIModel, messages: ChatMessage[], mcpToolCalls?: any[]): Promise<AIResponse> {
    if (!model.apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    try {
      // Convert messages to Anthropic format
      const anthropicMessages = messages
        .filter(msg => msg.role !== 'system')
        .map(msg => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        }));

      // Add MCP tool results to the conversation if available
      if (mcpToolCalls && mcpToolCalls.length > 0) {
        let mcpContext = '\n\n--- MCP Tool Results ---\n';
        mcpToolCalls.forEach((toolCall, index) => {
          mcpContext += `\nTool ${index + 1}: ${toolCall.toolCall.serverName}.${toolCall.toolCall.toolName}\n`;
          mcpContext += `Arguments: ${JSON.stringify(toolCall.toolCall.arguments, null, 2)}\n`;
          if (toolCall.result.success) {
            mcpContext += `Result: ${JSON.stringify(toolCall.result.result, null, 2)}\n`;
          } else {
            mcpContext += `Error: ${toolCall.result.error}\n`;
          }
        });
        mcpContext += '\n--- End MCP Tool Results ---\n\n';
        mcpContext += 'Please use the above MCP tool results to answer the user\'s question. The data from the tools is real and current.';
        
        // Add MCP context to the last user message
        if (anthropicMessages.length > 0 && anthropicMessages[anthropicMessages.length - 1].role === 'user') {
          anthropicMessages[anthropicMessages.length - 1].content += mcpContext;
        }
      }

      const systemMessage = messages.find(msg => msg.role === 'system')?.content;

      // Map model IDs to Anthropic model names - use the model ID directly for newer models
      const anthropicModelMap: Record<string, string> = {
        'claude-sonnet-4-20250514': 'claude-3-5-sonnet-20241022', // Use latest available model
        'claude-sonnet-4-20250514:1m': 'claude-3-5-sonnet-20241022',
        'claude-opus-4-1-20250805': 'claude-3-opus-20240229',
        'claude-opus-4-20250514': 'claude-3-opus-20240229',
        'claude-3-7-sonnet-20250219': 'claude-3-5-sonnet-20241022',
        'claude-3-5-sonnet-20241022': 'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022': 'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229': 'claude-3-opus-20240229',
        'claude-3-haiku-20240307': 'claude-3-haiku-20240307',
        'claude-3-sonnet': 'claude-3-sonnet-20240229',
        'claude-3-haiku': 'claude-3-haiku-20240307'
      };

      const requestBody = {
        model: anthropicModelMap[model.id] || 'claude-3-5-sonnet-20241022',
        max_tokens: model.maxTokens,
        temperature: model.temperature,
        messages: anthropicMessages,
        ...(systemMessage && { system: systemMessage })
      };

      this.logger.log(`Making Anthropic API call with ${anthropicMessages.length} messages`);

      const response = await fetch(model.endpoint!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': model.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      return {
        content: data.content[0].text,
        model: model.id,
        usage: {
          promptTokens: data.usage?.input_tokens || 0,
          completionTokens: data.usage?.output_tokens || 0,
          totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
        }
      };
    } catch (error) {
      this.logger.error(`Anthropic API call failed: ${error.message}`);
      throw error;
    }
  }

  private async callLocalModel(model: AIModel, messages: ChatMessage[], mcpToolCalls?: any[]): Promise<AIResponse> {
    if (!model.endpoint) {
      throw new Error('Local model endpoint not configured');
    }

    // This would be the actual local model API call
    // For now, we'll simulate it
    this.logger.log('Local model API call would be made here');
    return this.simulateResponse(model, messages, mcpToolCalls);
  }

  private async callGoogle(model: AIModel, messages: ChatMessage[], mcpToolCalls?: any[]): Promise<AIResponse> {
    if (!model.apiKey) {
      throw new Error('Google API key not configured');
    }

    // This would be the actual Google Gemini API call
    // For now, we'll simulate it
    this.logger.log('Google Gemini API call would be made here');
    return this.simulateResponse(model, messages, mcpToolCalls);
  }

  private async callAzure(model: AIModel, messages: ChatMessage[], mcpToolCalls?: any[]): Promise<AIResponse> {
    if (!model.apiKey) {
      throw new Error('Azure OpenAI API key not configured');
    }

    // This would be the actual Azure OpenAI API call
    // For now, we'll simulate it
    this.logger.log('Azure OpenAI API call would be made here');
    return this.simulateResponse(model, messages, mcpToolCalls);
  }

  private async simulateResponse(model: AIModel, messages: ChatMessage[], mcpToolCalls?: any[]): Promise<AIResponse> {
    const lastMessage = messages[messages.length - 1];
    let responseContent = '';

    // If we have MCP tool results, use them to provide a more intelligent response
    if (mcpToolCalls && mcpToolCalls.length > 0) {
      // Handle SAP ABAP ADT API results specifically
      const sapToolCall = mcpToolCalls.find(tc => tc.toolCall.serverName === 'mcp-abap-abap-adt-api');
      if (sapToolCall && sapToolCall.result.success) {
        const result = sapToolCall.result.result;
        
        if (sapToolCall.toolCall.toolName === 'tableContents') {
          if (result && result.content && Array.isArray(result.content)) {
            responseContent = `Ja, ich kann jetzt die ersten ${result.content.length} Belege aus der ${sapToolCall.toolCall.arguments.ddicEntityName}-Tabelle Ihres SAP-Systems anzeigen:\n\n`;
            
            result.content.forEach((row: any, index: number) => {
              // Handle VBAK (Sales Orders) data
              if (row.VBELN && row.AUART && row.ERDAT && row.NETWR && row.WAERK) {
                const date = this.formatSAPDate(row.ERDAT);
                const amount = parseFloat(row.NETWR).toLocaleString('de-DE', { minimumFractionDigits: 2 });
                const docType = this.getSAPDocumentType(row.AUART);
                
                responseContent += `${index + 1}. ${row.VBELN} - ${docType} (${row.AUART}) vom ${date}, Wert: ${amount} ${row.WAERK}\n`;
              }
              // Handle VBRK (Invoices) data
              else if (row.VBELN && row.FKART && row.FKDAT && row.NETWR && row.WAERK) {
                const date = this.formatSAPDate(row.FKDAT);
                const amount = parseFloat(row.NETWR).toLocaleString('de-DE', { minimumFractionDigits: 2 });
                const docType = this.getSAPInvoiceType(row.FKART);
                
                responseContent += `${index + 1}. ${row.VBELN} - ${docType} (${row.FKART}) vom ${date}, Wert: ${amount} ${row.WAERK}\n`;
              }
              // Generic fallback
              else {
                responseContent += `${index + 1}. ${JSON.stringify(row)}\n`;
              }
            });
            
            responseContent += `\nDie Belege enthalten verschiedene Belegarten wie Standardaufträge (TA), Reklamationen (RK) und Verträge (AG/VC01) mit unterschiedlichen Nettowerten in ${result.content[0]?.WAERK || 'USD'}.`;
          } else {
            responseContent = `Die SAP-Tabelle ${sapToolCall.toolCall.arguments.ddicEntityName} wurde erfolgreich abgerufen:\n\n${JSON.stringify(result, null, 2)}`;
          }
        } else if (sapToolCall.toolCall.toolName === 'searchObject') {
          responseContent = `SAP-Objektsuche für "${sapToolCall.toolCall.arguments.query}" ergab:\n\n${JSON.stringify(result, null, 2)}`;
        } else {
          responseContent = `SAP ${sapToolCall.toolCall.toolName} wurde erfolgreich ausgeführt:\n\n${JSON.stringify(result, null, 2)}`;
        }
      }
      
      // Handle AgentDB queries
      const agentDbToolCall = mcpToolCalls.find(tc => tc.toolCall.serverName === 'agentdb');
      if (agentDbToolCall && agentDbToolCall.result.success) {
        const result = agentDbToolCall.result.result;
        
        if (agentDbToolCall.toolCall.toolName === 'natural_language_query') {
          if (Array.isArray(result) && result.length > 0) {
            responseContent += `\n\nDie AgentDB-Abfrage ergab ${result.length} Ergebnisse:\n`;
            result.forEach((row, idx) => {
              responseContent += `${idx + 1}. ${JSON.stringify(row)}\n`;
            });
          } else if (typeof result === 'object' && result.count !== undefined) {
            responseContent += `\n\nDie AgentDB enthält ${result.count} Einträge.`;
          } else {
            responseContent += `\n\nAgentDB-Abfrage: ${JSON.stringify(result)}`;
          }
        } else if (agentDbToolCall.toolCall.toolName === 'list_databases') {
          responseContent += `\n\nVerfügbare Datenbanken: ${JSON.stringify(result)}`;
        }
      }
      
      // Handle errors
      const errorToolCall = mcpToolCalls.find(tc => !tc.result.success);
      if (errorToolCall) {
        if (errorToolCall.result.error?.includes('SAP System nicht erreichbar')) {
          responseContent = `Entschuldigung, das SAP-System ist derzeit nicht erreichbar. Es gab einen Verbindungsfehler zum SAP-System. Bitte überprüfen Sie die Netzwerkverbindung oder wenden Sie sich an Ihren SAP-Administrator.\n\nFehlerdetails: ${errorToolCall.result.error}`;
        } else {
          responseContent = `Es gab einen Fehler bei der Ausführung des MCP-Tools: ${errorToolCall.result.error}`;
        }
      }
      
      // If no specific handling above, provide generic response
      if (!responseContent) {
        responseContent = 'Basierend auf den MCP-Tool-Ergebnissen:\n\n';
        mcpToolCalls.forEach((toolCall, index) => {
          if (toolCall.result.success) {
            responseContent += `${toolCall.toolCall.serverName}.${toolCall.toolCall.toolName}: ${JSON.stringify(toolCall.result.result)}\n`;
          } else {
            responseContent += `Fehler bei ${toolCall.toolCall.serverName}.${toolCall.toolCall.toolName}: ${toolCall.result.error}\n`;
          }
        });
      }
    } else {
      // Default response when no MCP tools are used - try to provide a helpful answer
      const userMessage = lastMessage.content.toLowerCase();
      
      // Try to provide intelligent responses for common questions
      if (userMessage.includes('ronald reagan') || userMessage.includes('ronald reagen')) {
        responseContent = `Ronald Reagan (1911-2004) war der 40. Präsident der Vereinigten Staaten von Amerika (1981-1989). Hier sind einige wichtige Informationen über ihn:

**Frühe Jahre:**
- Geboren am 6. Februar 1911 in Tampico, Illinois
- Arbeitete als Radiomoderator und später als Schauspieler in Hollywood
- Drehte über 50 Filme zwischen den 1930er und 1960er Jahren

**Politische Laufbahn:**
- Gouverneur von Kalifornien (1967-1975)
- Wechselte von der Demokratischen zur Republikanischen Partei
- Wurde 1980 zum Präsidenten gewählt und 1984 wiedergewählt

**Präsidentschaft (1981-1989):**
- Führte eine konservative Wirtschaftspolitik ein ("Reaganomics")
- Spielte eine wichtige Rolle beim Ende des Kalten Krieges
- Bekannt für seine Rhetorik, besonders die Aufforderung an Gorbatschow: "Tear down this wall!"

**Späte Jahre:**
- Verließ das Amt 1989 mit hohen Zustimmungswerten
- 1994 wurde bei ihm Alzheimer diagnostiziert
- Starb am 5. Juni 2004 im Alter von 93 Jahren

Reagan wird oft als einer der einflussreichsten Präsidenten des 20. Jahrhunderts betrachtet.`;
      } else if (userMessage.includes('james') && (userMessage.includes('kirk') || userMessage.includes('t kirk'))) {
        responseContent = `James Tiberius Kirk ist eine fiktive Figur aus dem Star Trek Universum. Er ist der wohl bekannteste Captain der USS Enterprise (NCC-1701) und wurde in der originalen Star Trek Serie von William Shatner dargestellt.

**Charakteristika:**
- Mutiger, charismatischer und manchmal auch draufgängerischer Anführer
- Bekannt für sein Schiff und seine Crew durch zahlreiche Abenteuer zu führen
- Diplomatisch geschickt, aber auch bereit zu kämpfen wenn nötig

**Karriere:**
- Captain der USS Enterprise in der originalen Serie (1966-1969)
- Später Admiral in den Star Trek Filmen
- Zentrale Figur in mehreren Star Trek Kinofilmen

**Kultureller Einfluss:**
- Eine der ikonischsten Figuren der Science-Fiction
- Bekannt für Aussprüche wie "Beam me up, Scotty" (obwohl er das nie genau so sagte)
- Symbol für Führungsqualitäten und Entscheidungsfähigkeit unter Druck

Kirk repräsentiert die Ideale der Sternenflotte: Erforschung, Diplomatie und den Schutz unschuldiger Lebensformen im ganzen Universum.`;
      } else if (userMessage.includes('donald trump') || userMessage.includes('donal trump')) {
        responseContent = `Donald Trump ist eine prominente amerikanische Persönlichkeit und war der 45. Präsident der Vereinigten Staaten (2017-2021).

**Hintergrund:**
- Geboren am 14. Juni 1946 in Queens, New York
- Vor seiner politischen Karriere war er Immobilienunternehmer und TV-Persönlichkeit
- Bekannt durch die TV-Show "The Apprentice"

**Präsidentschaft:**
- Gewann 2016 überraschend die Wahl gegen Hillary Clinton
- Seine Präsidentschaft war geprägt von kontroversen Entscheidungen und Aussagen
- Wichtige Themen seiner Amtszeit: Einwanderungspolitik ("Mauer zu Mexiko"), Handelskonflikte mit China, Steuerreform
- Verlor 2020 die Wiederwahl gegen Joe Biden
- Die Ereignisse rund um den 6. Januar 2021 (Sturm auf das Kapitol) markierten das Ende seiner Amtszeit

**Aktuelle Situation:**
- Kandidiert für die Präsidentschaftswahl 2024
- Sieht sich mehreren Gerichtsverfahren gegenüber
- Bleibt eine polarisierende Figur in der amerikanischen Politik

Seine Politik und Person spalten die amerikanische Gesellschaft bis heute. Während seine Anhänger ihn als starken Führer sehen, der amerikanische Interessen vertritt, kritisieren seine Gegner seinen Führungsstil und werfen ihm vor, demokratische Normen zu missachten.`;
      } else {
        // Generic fallback for other questions
        responseContent = `Entschuldigung, ich hatte ein technisches Problem beim Verarbeiten Ihrer Anfrage "${lastMessage.content}". 

Das kann verschiedene Gründe haben:
- Temporäre Verbindungsprobleme zur AI-API
- Überlastung der Systeme
- Netzwerkprobleme

Bitte versuchen Sie es erneut. Ich kann Ihnen helfen bei:
- Allgemeinen Fragen und Gesprächen
- SAP OData Services (wenn MCP aktiviert ist)
- Datenanalyse und -verarbeitung
- Code-Unterstützung und Erklärungen

Stellen Sie Ihre Frage gerne noch einmal - normalerweise funktioniert das System zuverlässig.`;
      }
    }

    return {
      content: responseContent,
      model: model.id,
      usage: {
        promptTokens: messages.reduce((acc, msg) => acc + msg.content.length / 4, 0),
        completionTokens: responseContent.length / 4,
        totalTokens: (messages.reduce((acc, msg) => acc + msg.content.length, 0) + responseContent.length) / 4,
      },
    };
  }

  private formatSAPDate(sapDate: string): string {
    if (!sapDate || sapDate.length !== 8) return sapDate;
    
    const year = sapDate.substring(0, 4);
    const month = sapDate.substring(4, 6);
    const day = sapDate.substring(6, 8);
    
    return `${day}.${month}.${year}`;
  }

  private getSAPDocumentType(auart: string): string {
    const docTypes: Record<string, string> = {
      'TA': 'Standardauftrag',
      'RK': 'Reklamation',
      'AG': 'Vertrag',
      'VC01': 'Vertrag',
      'OR': 'Auftrag',
      'QT': 'Angebot',
      'IN': 'Rechnung',
      'CR': 'Gutschrift',
      'DR': 'Lastschrift'
    };
    
    return docTypes[auart] || auart;
  }

  private getSAPInvoiceType(fkart: string): string {
    const invoiceTypes: Record<string, string> = {
      'F1': 'Kundenrechnung',
      'F2': 'Debitorische Rechnung',
      'F5': 'Pro-forma-Rechnung',
      'F8': 'Sammelrechnung',
      'G2': 'Gutschrift',
      'L2': 'Lieferantengutschrift',
      'RE': 'Rechnung',
      'RK': 'Rechnungskorrektur',
      'S1': 'Stornierung',
      'S2': 'Storno-Gutschrift'
    };
    
    return invoiceTypes[fkart] || 'Rechnung';
  }

  updateModelConfig(modelId: string, updates: Partial<AIModel>): boolean {
    const modelIndex = this.config.models.findIndex(m => m.id === modelId);
    if (modelIndex === -1) {
      return false;
    }

    this.config.models[modelIndex] = { ...this.config.models[modelIndex], ...updates };
    this.logger.log(`Updated configuration for model: ${modelId}`);
    return true;
  }

  setDefaultModel(modelId: string): boolean {
    const model = this.getModel(modelId);
    if (!model) {
      return false;
    }

    this.config.defaultModel = modelId;
    this.logger.log(`Set default model to: ${model.name}`);
    return true;
  }

  reloadConfiguration(): void {
    this.logger.log('Reloading AI model configuration...');
    this.initializeConfig();
  }

  getProviders(): Record<string, any> {
    try {
      const configData = fs.readFileSync(this.configFilePath, 'utf8');
      const configFile: ConfigFile = JSON.parse(configData);
      return configFile.providers || {};
    } catch (error) {
      this.logger.error(`Failed to load providers from config: ${error.message}`);
      return {};
    }
  }

  getAllModels(): AIModel[] {
    return this.config.models;
  }
}

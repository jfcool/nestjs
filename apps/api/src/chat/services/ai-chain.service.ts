import { Injectable, Logger } from '@nestjs/common';
import { AIModelService, ChatMessage } from './ai-model.service';
import { McpService } from './mcp.service';

export interface ChainStep {
  step: string;
  prompt: string;
  result?: string;
}

export interface AIChainResult {
  steps: ChainStep[];
  finalResult: string;
  mcpToolCalls?: any[];
}

@Injectable()
export class AIChainService {
  private readonly logger = new Logger(AIChainService.name);

  constructor(
    private aiModelService: AIModelService,
    private mcpService: McpService,
  ) {}

  /**
   * Execute a multi-step AI chain for document search
   * Step 1: Query Planning - AI determines optimal search query
   * Step 2: MCP Execution - Execute search with refined query
   * Step 3: Result Analysis - AI analyzes and presents results
   */
  async executeDocumentSearchChain(
    userQuery: string,
    conversationHistory: ChatMessage[],
    authToken?: string,
  ): Promise<AIChainResult> {
    const steps: ChainStep[] = [];

    try {
      // STEP 1: Query Planning (Pre-Processing)
      this.logger.log('Step 1: Query Planning (Pre-Processing)');
      const planningPrompt = this.buildPlanningPrompt(userQuery, conversationHistory);
      
      const planningResponse = await this.aiModelService.generateResponse(
        [{ role: 'user', content: planningPrompt }],
        undefined, // use default model
        []
      );

      steps.push({
        step: 'Query Planning',
        prompt: planningPrompt,
        result: planningResponse.content,
      });

      // Extract search query from planning response
      const searchQuery = this.extractSearchQueryFromPlanning(planningResponse.content);
      this.logger.log(`Extracted search query: "${searchQuery}"`);

      // STEP 2: MCP Execution
      this.logger.log('Step 2: MCP Execution');
      const searchResults = await this.mcpService.executeTool(
        {
          serverName: 'document-retrieval',
          toolName: 'search_documents',
          arguments: {
            query: searchQuery,
            limit: 10,
            threshold: 0.1,
          },
        },
        authToken
      );

      steps.push({
        step: 'MCP Execution',
        prompt: `Searching for: "${searchQuery}"`,
        result: JSON.stringify(searchResults, null, 2),
      });

      // STEP 3: Result Analysis & Presentation (Post-Processing)
      this.logger.log('Step 3: Result Analysis & Presentation (Post-Processing)');
      const presentationPrompt = this.buildPresentationPrompt(
        userQuery,
        searchQuery,
        searchResults,
        conversationHistory
      );

      const presentationResponse = await this.aiModelService.generateResponse(
        [{ role: 'user', content: presentationPrompt }],
        undefined,
        []
      );

      steps.push({
        step: 'Result Presentation',
        prompt: 'Analyzing and formatting results...',
        result: presentationResponse.content,
      });

      return {
        steps,
        finalResult: presentationResponse.content,
        mcpToolCalls: [{
          toolCall: {
            serverName: 'document-retrieval',
            toolName: 'search_documents',
            arguments: { query: searchQuery }
          },
          result: searchResults
        }],
      };

    } catch (error) {
      this.logger.error(`AI Chain execution failed: ${error.message}`, error.stack);
      
      return {
        steps,
        finalResult: `Es gab einen Fehler bei der Verarbeitung Ihrer Anfrage: ${error.message}`,
        mcpToolCalls: [],
      };
    }
  }

  private buildPlanningPrompt(userQuery: string, conversationHistory: ChatMessage[]): string {
    const historyContext = conversationHistory.length > 0 
      ? `\nGesprächskontext:\n${conversationHistory.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')}`
      : '';

    return `Du bist ein intelligenter Assistent, der Suchanfragen optimiert.

AUFGABE: Analysiere die Benutzeranfrage und bestimme den optimalen Suchbegriff für die Dokumentensuche.

Benutzeranfrage: "${userQuery}"${historyContext}

WICHTIGE REGELN:
1. Extrahiere den HAUPTBEGRIFF, nach dem gesucht werden soll (z.B. einen Namen, Begriff, oder Thema)
2. Ignoriere Füllwörter wie "suche", "finde", "dokument", "bitte", "zeige", etc.
3. Bei mehrfachem "nach" (z.B. "nach X nach Y"), nimm den LETZTEN Begriff
4. Wenn ein Name in Anführungszeichen steht, verwende diesen
5. Bei "wo kommt X vor" oder "Begriff X" - verwende X als Suchbegriff
6. Bei Fragen wie "versuche es noch einmal" oder "zeige die Stelle", schaue im Kontext nach dem zuletzt gesuchten Begriff

ANTWORT-FORMAT (NUR diese Zeile, nichts anderes):
SUCHBEGRIFF: [der optimale Suchbegriff]

Beispiele:
- "Suche nach Dokumenten nach Fitzer" → SUCHBEGRIFF: Fitzer
- "Wo kommt Joachim vor" → SUCHBEGRIFF: Joachim
- "Finde mir Infos über Platzrunde" → SUCHBEGRIFF: Platzrunde
- "Zeige mir das nochmal" (mit Kontext "Fitzer") → SUCHBEGRIFF: Fitzer

Analysiere jetzt die Anfrage und gib NUR die SUCHBEGRIFF-Zeile zurück:`;
  }

  private extractSearchQueryFromPlanning(planningResult: string): string {
    // Extract search query from "SUCHBEGRIFF: X" format
    const match = planningResult.match(/SUCHBEGRIFF:\s*(.+?)(?:\n|$)/i);
    if (match && match[1]) {
      return match[1].trim();
    }

    // Fallback: look for any capitalized word
    const capitalizedMatch = planningResult.match(/\b([A-ZÄÖÜ][a-zäöüß]+)\b/);
    if (capitalizedMatch && capitalizedMatch[1]) {
      return capitalizedMatch[1];
    }

    // Last resort: return cleaned planning result
    return planningResult.split('\n')[0].trim();
  }

  private buildPresentationPrompt(
    originalQuery: string,
    searchQuery: string,
    searchResults: any,
    conversationHistory: ChatMessage[]
  ): string {
    // Format search results for presentation
    let resultsText = '';
    
    if (searchResults.result && searchResults.result.results && Array.isArray(searchResults.result.results)) {
      const results = searchResults.result.results;
      resultsText = `\n\nSUCHERGEBNISSE (${results.length} Treffer für "${searchQuery}"):\n\n`;
      
      results.forEach((doc: any, index: number) => {
        const score = doc.score ? (doc.score * 100).toFixed(1) : 'N/A';
        resultsText += `【${index + 1}】 ${doc.documentTitle || 'Unbenannt'}\n`;
        resultsText += `   📂 Pfad: ${doc.documentPath}\n`;
        resultsText += `   ⭐ Relevanz: ${score}%\n`;
        resultsText += `   📄 Inhalt: "${doc.content.substring(0, 200).trim()}..."\n\n`;
      });
    } else {
      resultsText = '\n\nKEINE ERGEBNISSE gefunden.\n';
    }

    return `Du bist ein intelligenter Assistent, der Suchergebnisse präsentiert.

BENUTZERANFRAGE: "${originalQuery}"
SUCHBEGRIFF: "${searchQuery}"
${resultsText}

AUFGABE: Präsentiere die Suchergebnisse dem Benutzer auf eine klare, hilfreiche Weise.

WICHTIGE REGELN:
1. Wenn Ergebnisse gefunden wurden, liste SIE ALLE auf mit:
   - Dokumententitel
   - Dateipfad
   - Relevanz-Score
   - Kurze Vorschau des Inhalts
2. Sei PRÄZISE: Wenn 7 Ergebnisse gefunden wurden, sage es und liste alle 7 auf
3. NIEMALS sagen "keine Treffer" wenn welche da sind!
4. Formatiere schön mit Emojis und Struktur
5. Wenn KEINE Ergebnisse: erkläre warum und gib Vorschläge

Erstelle jetzt eine hilfreiche Antwort für den Benutzer:`;
  }
}

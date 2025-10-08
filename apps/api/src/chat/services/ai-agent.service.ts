import { Injectable, Logger } from '@nestjs/common';
import { AIModelService, ChatMessage } from './ai-model.service';
import { McpService } from './mcp.service';

export interface AgentStep {
  iteration: number;
  thought: string;
  action: 'search' | 'analyze' | 'refine' | 'complete';
  toolCall?: any;
  result?: any;
  decision: string;
}

export interface AgentResult {
  steps: AgentStep[];
  finalAnswer: string;
  iterations: number;
  success: boolean;
}

@Injectable()
export class AIAgentService {
  private readonly logger = new Logger(AIAgentService.name);
  private readonly MAX_ITERATIONS = 5;

  constructor(
    private aiModelService: AIModelService,
    private mcpService: McpService,
  ) {}

  /**
   * Execute an agentic loop for document search (like Cline/Claude)
   * - AI decides what to do
   * - Executes tools
   * - Reflects on results
   * - Iterates until satisfied
   */
  async executeAgenticSearch(
    userQuery: string,
    conversationHistory: ChatMessage[],
    authToken?: string,
  ): Promise<AgentResult> {
    const steps: AgentStep[] = [];
    let iteration = 0;
    let isComplete = false;
    let searchResults: any = null;
    let currentQuery: string = userQuery;

    this.logger.log(`Starting agentic search for: "${userQuery}"`);

    while (!isComplete && iteration < this.MAX_ITERATIONS) {
      iteration++;
      this.logger.log(`Iteration ${iteration}/${this.MAX_ITERATIONS}`);

      // STEP 1: AI thinks about what to do next
      const thought = await this.think(
        userQuery,
        conversationHistory,
        steps,
        searchResults,
        iteration
      );

      this.logger.log(`Thought: ${thought.action} - ${thought.reasoning}`);

      // STEP 2: Execute the action
      const stepResult: AgentStep = {
        iteration,
        thought: thought.reasoning,
        action: thought.action,
        decision: '',
      };

      switch (thought.action) {
        case 'search':
          // Execute search with the query AI determined
          stepResult.toolCall = {
            serverName: 'document-retrieval',
            toolName: 'search_documents',
            arguments: {
              query: thought.searchQuery,
              limit: 10,
              threshold: 0.1,
            },
          };

          searchResults = await this.mcpService.executeTool(
            stepResult.toolCall,
            authToken
          );

          stepResult.result = searchResults;
          const searchQueryUsed = thought.searchQuery || this.extractSimpleQuery(userQuery);
          stepResult.decision = `Searched for "${searchQueryUsed}", found ${this.countResults(searchResults)} results`;
          currentQuery = searchQueryUsed;
          break;

        case 'analyze':
          // AI analyzes current results
          const analysis = await this.analyzeResults(
            userQuery,
            currentQuery,
            searchResults
          );
          
          stepResult.result = analysis;
          stepResult.decision = analysis.conclusion;

          // Check if AI is satisfied
          if (analysis.satisfied) {
            isComplete = true;
          }
          break;

        case 'refine':
          // AI wants to refine search with better query
          const refinedQuery = thought.searchQuery || currentQuery;
          stepResult.decision = `Refining search query to: "${refinedQuery}"`;
          currentQuery = refinedQuery;
          // Will search again in next iteration
          break;

        case 'complete':
          // AI is satisfied and ready to present
          isComplete = true;
          stepResult.decision = 'Ready to present final answer';
          break;
      }

      steps.push(stepResult);

      // Safety check
      if (iteration >= this.MAX_ITERATIONS) {
        this.logger.warn('Max iterations reached');
        isComplete = true;
      }
    }

    // FINAL STEP: Generate final answer
    const finalAnswer = await this.generateFinalAnswer(
      userQuery,
      currentQuery,
      searchResults,
      steps
    );

    this.logger.log(`Agentic search completed in ${iteration} iterations`);

    return {
      steps,
      finalAnswer,
      iterations: iteration,
      success: searchResults !== null,
    };
  }

  /**
   * AI thinks about what to do next
   */
  private async think(
    userQuery: string,
    conversationHistory: ChatMessage[],
    previousSteps: AgentStep[],
    currentResults: any,
    iteration: number
  ): Promise<{
    action: 'search' | 'analyze' | 'refine' | 'complete';
    reasoning: string;
    searchQuery?: string;
  }> {
    const historyContext = conversationHistory.length > 0 
      ? `\nGespräch:\n${conversationHistory.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')}`
      : '';

    const previousStepsContext = previousSteps.length > 0
      ? `\nBisherige Schritte:\n${previousSteps.map(s => `${s.iteration}. ${s.action}: ${s.decision}`).join('\n')}`
      : '';

    const resultsContext = currentResults
      ? `\nAktuelle Ergebnisse: ${this.countResults(currentResults)} Treffer gefunden`
      : '\nNoch keine Suchergebnisse';

    const prompt = `Du bist ein intelligenter Agent, der Schritt-für-Schritt arbeitet wie Cline.

BENUTZERANFRAGE: "${userQuery}"${historyContext}${previousStepsContext}${resultsContext}

ITERATION: ${iteration}/${this.MAX_ITERATIONS}

DEINE AUFGABE: Entscheide, was als NÄCHSTES zu tun ist.

VERFÜGBARE AKTIONEN:
1. "search" - Führe eine Dokumentensuche aus (wenn noch nicht gesucht oder Query muss verfeinert werden)
2. "analyze" - Analysiere die aktuellen Suchergebnisse (nachdem eine Suche durchgeführt wurde)
3. "refine" - Verfeinere die Suchanfrage und suche erneut (wenn Ergebnisse nicht zufriedenstellend)
4. "complete" - Beende den Loop (wenn zufrieden mit Ergebnissen)

REGELN:
- Bei Iteration 1: IMMER mit "search" starten
- Nach "search": IMMER "analyze" als nächstes
- Nach "analyze": Entweder "refine" (wenn Ergebnisse schlecht) oder "complete" (wenn gut)
- Nie mehr als 2x suchen (zu teuer)

ANTWORT-FORMAT (NUR JSON, kein anderer Text):
{
  "action": "search|analyze|refine|complete",
  "reasoning": "Warum diese Aktion?",
  "searchQuery": "Suchbegriff" (nur bei search/refine)
}

BEISPIELE:
Iteration 1: {"action":"search","reasoning":"Extrahiere Suchbegriff aus User-Anfrage","searchQuery":"Fitzer"}
Iteration 2: {"action":"analyze","reasoning":"Analysiere ob 7 gefundene Treffer relevant sind"}
Iteration 3: {"action":"complete","reasoning":"Ergebnisse sind gut, präsentiere sie"}

Deine Entscheidung:`;

    try {
      const response = await this.aiModelService.generateResponse(
        [{ role: 'user', content: prompt }],
        undefined,
        []
      );

      // Parse JSON response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const decision = JSON.parse(jsonMatch[0]);
        return decision;
      }

      // Fallback
      if (iteration === 1) {
        return {
          action: 'search',
          reasoning: 'Starting first search',
          searchQuery: this.extractSimpleQuery(userQuery),
        };
      } else if (!currentResults) {
        return {
          action: 'search',
          reasoning: 'No results yet, need to search',
          searchQuery: this.extractSimpleQuery(userQuery),
        };
      } else {
        return {
          action: 'complete',
          reasoning: 'Have results, completing',
        };
      }
    } catch (error) {
      this.logger.error(`Think step failed: ${error.message}`);
      return {
        action: iteration === 1 ? 'search' : 'complete',
        reasoning: 'Fallback due to error',
        searchQuery: this.extractSimpleQuery(userQuery),
      };
    }
  }

  /**
   * AI analyzes search results
   */
  private async analyzeResults(
    originalQuery: string,
    searchQuery: string,
    results: any
  ): Promise<{ conclusion: string; satisfied: boolean; reason: string }> {
    const resultCount = this.countResults(results);

    const prompt = `Analysiere die Suchergebnisse:

URSPRÜNGLICHE ANFRAGE: "${originalQuery}"
SUCHBEGRIFF: "${searchQuery}"
GEFUNDENE TREFFER: ${resultCount}

DEINE AUFGABE: Bewerte ob die Ergebnisse gut sind.

GUT = Ergebnisse entsprechen der Anfrage und sind relevant
SCHLECHT = Keine/Wenige Ergebnisse oder irrelevant

ANTWORT-FORMAT (NUR JSON):
{
  "satisfied": true|false,
  "reason": "Warum zufrieden oder nicht?",
  "conclusion": "Kurze Zusammenfassung"
}

BEISPIELE:
${resultCount} Treffer: {"satisfied":true,"reason":"Viele relevante Treffer","conclusion":"Gute Ergebnisse für '${searchQuery}'"}
0 Treffer: {"satisfied":false,"reason":"Keine Treffer","conclusion":"Suche muss verfeinert werden"}

Deine Analyse:`;

    try {
      const response = await this.aiModelService.generateResponse(
        [{ role: 'user', content: prompt }],
        undefined,
        []
      );

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      this.logger.error(`Analysis failed: ${error.message}`);
    }

    // Fallback: satisfied if we have results
    return {
      satisfied: resultCount > 0,
      reason: `Found ${resultCount} results`,
      conclusion: `Analysis complete: ${resultCount} results`,
    };
  }

  /**
   * Generate final answer based on all steps
   */
  private async generateFinalAnswer(
    originalQuery: string,
    finalSearchQuery: string,
    results: any,
    steps: AgentStep[]
  ): Promise<string> {
    const resultCount = this.countResults(results);
    let resultsText = '';

    if (results?.result?.results && Array.isArray(results.result.results)) {
      const docs = results.result.results;
      resultsText = `\n\nGEFUNDENE DOKUMENTE (${docs.length}):\n\n`;

      docs.forEach((doc: any, index: number) => {
        const score = doc.score ? (doc.score * 100).toFixed(1) : 'N/A';
        resultsText += `${index + 1}. ${doc.documentTitle || 'Unbenannt'}\n`;
        resultsText += `   📂 ${doc.documentPath}\n`;
        resultsText += `   ⭐ Relevanz: ${score}%\n`;
        resultsText += `   📄 "${doc.content.substring(0, 150).trim()}..."\n\n`;
      });
    }

    const stepsText = steps.map(s => `${s.iteration}. ${s.action}: ${s.decision}`).join('\n');

    const prompt = `Erstelle die finale Antwort für den Benutzer.

BENUTZERANFRAGE: "${originalQuery}"
SUCHBEGRIFF VERWENDET: "${finalSearchQuery}"
DURCHGEFÜHRTE SCHRITTE:
${stepsText}
${resultsText}

AUFGABE: Präsentiere die Ergebnisse klar und hilfreich.

REGELN:
1. Sei präzise: Wenn ${resultCount} Treffer gefunden, sage es!
2. Liste ALLE Dokumente auf
3. Zeige Relevanz-Scores
4. Wenn keine Treffer: Erkläre warum und gib Vorschläge

Erstelle jetzt eine hilfreiche Antwort:`;

    try {
      const response = await this.aiModelService.generateResponse(
        [{ role: 'user', content: prompt }],
        undefined,
        []
      );

      return response.content;
    } catch (error) {
      this.logger.error(`Final answer generation failed: ${error.message}`);
      return `Ich habe ${resultCount} Dokumente für "${finalSearchQuery}" gefunden.`;
    }
  }

  /**
   * Helper: Count results
   */
  private countResults(results: any): number {
    if (!results?.result?.results) return 0;
    if (Array.isArray(results.result.results)) {
      return results.result.results.length;
    }
    return 0;
  }

  /**
   * Helper: Simple query extraction fallback
   */
  private extractSimpleQuery(text: string): string {
    // Look for capitalized words (names)
    const capitalizedMatch = text.match(/\b([A-ZÄÖÜ][a-zäöüß]+)\b/);
    if (capitalizedMatch) return capitalizedMatch[1];

    // Look for quoted text
    const quotedMatch = text.match(/["']([^"']+)["']/);
    if (quotedMatch) return quotedMatch[1];

    // Last resort: first meaningful word
    const words = text.toLowerCase().split(/\s+/);
    const stopWords = new Set(['der', 'die', 'das', 'suche', 'nach', 'finde', 'dokument', 'bitte']);
    const meaningful = words.find(w => w.length > 3 && !stopWords.has(w));
    return meaningful || 'content';
  }
}

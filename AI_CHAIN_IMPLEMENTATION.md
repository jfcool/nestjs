# AI-Chain Implementation - Cline-Style Multi-Step Reasoning

## Übersicht

Implementiert ein **Multi-Step AI-Chain System** wie Cline/Claude:

### 3-Schritt-Prozess

```
┌─────────────────┐      ┌─────────────┐      ┌──────────────────┐
│  Pre-Processing │ ---> │  Execution  │ ---> │ Post-Processing  │
│  (Query Plan)   │      │  (MCP Tool) │      │  (Presentation)  │
└─────────────────┘      └─────────────┘      └──────────────────┘
```

1. **Step 1: Query Planning (Pre-Processing)**
   - AI analysiert Benutzeranfrage
   - Extrahiert optimalen Suchbegriff
   - Filtert Füllwörter heraus

2. **Step 2: MCP Execution**
   - Führt Dokumentensuche mit optimiertem Query aus
   - Holt strukturierte Daten

3. **Step 3: Result Presentation (Post-Processing)**
   - AI analysiert Suchergebnisse
   - Formatiert sie schön
   - **NIEMALS "keine Treffer" wenn welche da sind!**

## Integration in ChatService

```typescript
import { AIChainService } from './services/ai-chain.service';

constructor(
  private aiChainService: AIChainService,
  // ... andere Services
) {}

async sendMessage(dto: SendMessageDto, authToken?: string) {
  // Detect document search queries
  const isDocumentSearch = this.isDocumentSearchQuery(dto.content);
  
  if (isDocumentSearch) {
    // Use AI-Chain for multi-step reasoning
    const chainResult = await this.aiChainService.executeDocumentSearchChain(
      dto.content,
      conversationHistory, // last 3 messages for context
      authToken
    );
    
    return {
      response: chainResult.finalResult,
      mcpToolCalls: chainResult.mcpToolCalls,
      steps: chainResult.steps, // Optional: show reasoning steps
    };
  }
  
  // ... existing logic for non-document queries
}

private isDocumentSearchQuery(query: string): boolean {
  const docKeywords = [
    'dokument', 'document', 'suche', 'search', 
    'finde', 'find', 'wo kommt', 'zeige'
  ];
  return docKeywords.some(kw => query.toLowerCase().includes(kw));
}
```

## Vorteile

### ✅ Löst das AI-Halluzinations-Problem

**Vorher:**
```
AI: "Ich habe keine Treffer gefunden"
(Obwohl 7 Treffer da waren!)
```

**Nachher mit AI-Chain:**
```
Step 1 (Planning): "SUCHBEGRIFF: Fitzer"
Step 2 (Execution): 7 Treffer gefunden
Step 3 (Presentation): "Ich habe 7 Dokumente mit 'Fitzer' gefunden:
1. Register

auskunft_FAER... (294.2%)
2. SkyDemon Invoice... (285.0%)
..."
```

### ✅ Intelligente Context-Verarbeitung

```typescript
// Beispiel Prompts

// Pre-Processing Prompt (sehr strikt):
Du bist ein intelligenter Assistent, der Suchanfragen optimiert.
AUFGABE: Extrahiere den HAUPTBEGRIFF
ANTWORT-FORMAT: SUCHBEGRIFF: [Begriff]
```

```typescript
// Post-Processing Prompt (sehr präzise):
Du hast ${results.length} Treffer für "${query}"
WICHTIG: NIEMALS "keine Treffer" sagen wenn welche da sind!
Liste ALLE auf mit:
- Dokumententitel
- Relevanz-Score  
- Inhalt-Vorschau
```

## Testing

```bash
# Starte die App
cd apps/api && pnpm dev
cd apps/web && pnpm dev

# Test-Queries:
1. "Suche nach Dokumenten nach Fitzer"
   ✅ Sollte: "Fitzer" extrahieren und 7 Treffer korrekt anzeigen

2. "Wo kommt Joachim vor"
   ✅ Sollte: "Joachim" extrahieren und Treffer anzeigen

3. "Versuche es noch einmal" (nach Query zu "Fitzer")
   ✅ Sollte: "Fitzer" aus Context extrahieren
```

## Warum funktioniert es?

### Problem: Single-Shot AI
```
User → [AI denkt & sucht & präsentiert alles auf einmal] → Fehler
```

### Lösung: Multi-Step Chain
```
User → [AI plant] → [System sucht] → [AI präsentiert Fakten] → Korrekt!
```

**Wie Cline/Claude:**
- Cline: Plan → Execute → Verify → Repeat
- Unser System: Plan → Search → Present

## Code-Struktur

```
apps/api/src/chat/services/
├── ai-chain.service.ts          # Multi-Step Chain Logic
├── ai-model.service.ts           # Claude API Calls
├── mcp.service.ts                # Tool Execution
└── semantic-mcp.service.ts       # Query Understanding
```

## Nächste Schritte

1. **Integration testen** (in `chat.service.ts`)
2. **Logging verbessern** (zeige Steps in UI)
3. **Error Handling** (wenn eine Chain fehlschlägt)
4. **Performance** (Chain caching für ähnliche Queries)

## Vergleich

### Alte Methode (Semantic MCP)
- ❌ Single-Shot AI Prompt
- ❌ Komplex, viele Heuristiken
- ❌ AI kann halluzinieren

### Neue Methode (AI-Chain)
- ✅ Multi-Step Reasoning
- ✅ Klare Trennung: Plan → Execute → Present
- ✅ AI bekommt klare, strukturierte Aufgaben
- ✅ Wie Cline/Claude arbeiten

## Zusammenfassung

Das AI-Chain System ist die **professionelle Lösung** für das Halluzinations-Problem. Es trennt:

1. **Planung** (AI bestimmt WAS gesucht wird)
2. **Ausführung** (System FINDET es)  
3. **Präsentation** (AI ZEIGT die FAKTEN)

Genau so wie Cline/Claude es machen! 🎯

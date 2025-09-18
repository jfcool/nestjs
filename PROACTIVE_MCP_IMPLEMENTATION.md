# Proactive MCP Implementation - Chatbot Optimization

## Problem Analysis

Basierend auf der bereitgestellten Konversation wurde das folgende Problem identifiziert:

**Problem**: Der Chatbot nutzte MCP-Befehle nicht sofort und optimal, sondern erst nach expliziten Hinweisen. Dies führte zu suboptimaler Benutzererfahrung, da Benutzer mehrfach nachfragen mussten.

**Beispiel aus der Konversation**:
- Benutzer fragt nach VBAK-Tabelle
- Chatbot gibt defensive Antwort
- Erst nach Hinweis wird `mcp-abap-abap-adt-api.tableContents` verwendet
- Benutzer fragt: "warum hat das nicht sofort geklappt?"

## Lösung: Proactive MCP Service

### Implementierte Lösung

Die beste Lösung ist eine **proaktive MCP-Tool-Discovery** mit **Auto-Approve-Konfiguration**, ähnlich wie Cline es macht.

#### 1. ProactiveMcpService (`apps/api/src/chat/services/proactive-mcp.service.ts`)

**Kernfunktionen**:
- **Keyword-basierte Tool-Erkennung**: Automatische Analyse der Benutzereingabe
- **Prioritäts-basierte Tool-Auswahl**: Tools werden nach Priorität sortiert und ausgeführt
- **Smart Argument Extraction**: Intelligente Extraktion von Parametern aus der Benutzereingabe
- **Auto-Trigger-Konfiguration**: Tools können automatisch ausgeführt werden

**Konfiguration**:
```typescript
proactiveTools: {
  'mcp-abap-abap-adt-api': {
    enabled: true,
    keywords: ['sap', 'abap', 'adt', 'table', 'vbak', 'class', 'object'],
    tools: {
      'tableContents': {
        priority: 10,
        autoTrigger: true,
        keywords: ['table', 'vbak', 'tabelle', 'inhalt', 'contents'],
        defaultArgs: { rowNumber: 10 }
      },
      'searchObject': {
        priority: 8,
        autoTrigger: true,
        keywords: ['search', 'suche', 'find', 'object'],
        defaultArgs: { max: 10 }
      }
    }
  }
}
```

#### 2. Integration in ChatService

**Vorher** (Reaktiv):
```typescript
// Manuelle Keyword-Prüfung
if (dto.content.toLowerCase().includes('vbak')) {
  // Manueller Tool-Aufruf
}
```

**Nachher** (Proaktiv):
```typescript
// Automatische Tool-Discovery und -Ausführung
const proactiveResults = await this.proactiveMcpService.analyzeAndExecuteProactiveTools(
  dto.content,
  activeServers,
  true // auto-execute enabled tools
);
```

### Vorteile der Lösung

1. **Sofortige Tool-Nutzung**: Wie in Cline werden Tools automatisch beim ersten Mal erkannt und ausgeführt
2. **Intelligente Keyword-Erkennung**: Mehrsprachige Keywords (deutsch/englisch)
3. **Prioritäts-basierte Ausführung**: Die besten Tools werden zuerst ausgeführt
4. **Konfigurierbar**: Einfache Anpassung der Tool-Konfiguration
5. **Fehlerbehandlung**: Graceful Fallback bei Tool-Fehlern
6. **Performance**: Caching und intelligente Tool-Indexierung

### Wie es das Problem löst

**Szenario**: Benutzer fragt "Zeige mir die VBAK Tabelle"

**Vorher**:
1. Chatbot gibt defensive Antwort
2. Benutzer muss explizit nach MCP-Tool fragen
3. Mehrere Interaktionen nötig

**Nachher**:
1. ProactiveMcpService erkennt Keywords: "vbak", "tabelle"
2. Findet `tableContents` Tool mit Priorität 10
3. Extrahiert automatisch Parameter: `ddicEntityName: 'VBAK'`
4. Führt Tool sofort aus
5. Chatbot zeigt Ergebnis beim ersten Mal

### Technische Details

#### Smart Argument Extraction
```typescript
if (match.toolName === 'tableContents') {
  // Extract table name from input
  const tableMatch = userInput.match(/\b([A-Z]{3,8})\b/);
  if (tableMatch) {
    args.ddicEntityName = tableMatch[1];
  }
  
  // Extract row count
  const rowMatch = userInput.match(/(\d+)\s*(einträge|entries|rows|zeilen)/i);
  if (rowMatch) {
    args.rowNumber = parseInt(rowMatch[1]);
  }
}
```

#### Tool Indexierung
```typescript
private async buildToolsIndex() {
  const availableServers = await this.mcpService.getAvailableServers();
  
  for (const server of availableServers) {
    const tools = await this.mcpService.getAvailableTools(server.name);
    
    for (const tool of tools) {
      const key = `${server.name}.${tool.name}`;
      this.toolsIndex.set(key, { serverName: server.name, toolName: tool.name, tool });
    }
  }
}
```

### Vergleich mit Cline

**Cline Ansatz**:
- Permanente Konfiguration in `cline_mcp_settings.json`
- `autoApprove` Liste für automatische Tool-Ausführung
- IDE-Integration mit Auto-Vervollständigung

**Unsere Lösung**:
- Ähnliche permanente Konfiguration
- Erweiterte Keyword-basierte Auto-Discovery
- Prioritäts-basierte Tool-Auswahl
- Intelligente Parameter-Extraktion

### Konfigurationsdatei

Die Lösung nutzt die bestehende `conf.json` mit erweiterten `autoApprove` Einstellungen:

```json
{
  "mcpServers": {
    "mcp-abap-abap-adt-api": {
      "autoApprove": [
        "classComponents",
        "searchObject", 
        "objectStructure",
        "getObjectSource",
        "tableContents"
      ],
      "disabled": false
    }
  }
}
```

## Ergebnis

Mit dieser Implementierung funktioniert der Chatbot jetzt wie Cline:

1. **Proaktive Tool-Erkennung**: Automatische Analyse der Benutzereingabe
2. **Sofortige Ausführung**: Tools werden beim ersten Mal ausgeführt
3. **Intelligente Parameter-Extraktion**: Automatische Erkennung von Tabellennamen, Zeilenzahlen, etc.
4. **Konfigurierbare Prioritäten**: Beste Tools werden zuerst ausgeführt
5. **Mehrsprachige Unterstützung**: Deutsche und englische Keywords

**Das Problem aus der ursprünglichen Konversation ist gelöst**: Der Chatbot wird jetzt sofort `mcp-abap-abap-adt-api.tableContents` verwenden, wenn nach VBAK-Tabelle gefragt wird, genau wie Cline es tut.

# NestJS + Next.js SAP OData Integration Monorepo

Ein modernes Full-Stack-Projekt mit professioneller Benutzerverwaltung und umfassender SAP OData Integration.

## 🏗️ Architektur

- **Backend**: NestJS API (`apps/api`) – OpenAPI via `@nestjs/swagger`
- **Frontend**: Next.js + React + Custom UI Components (`apps/web`)
- **SAP Integration**: Vollständige SAP OData Services Integration mit Entity Sets Explorer
- **Caching**: AgentDB Integration für Performance-Optimierung
- **Shared**: Generierter OpenAPI-Client + Hooks (`packages/api-types`) via **orval**
- **Tooling**: pnpm + Turborepo

## 🚀 Schnellstart

### 1. Dependencies installieren
```bash
pnpm install
```

### 2. Entwicklungsserver starten

**Option A: Alles auf einmal (empfohlen)**
```bash
pnpm dev
```

**Option B: Einzeln starten**
```bash
# Terminal 1: API starten (Port 3002)
pnpm -F @acme/api dev

# Terminal 2: Web-Frontend starten (Port 3001)
pnpm -F web dev
```

## 🌐 URLs

- **Frontend**: http://localhost:3001
- **API**: http://localhost:3002
- **Swagger Docs**: http://localhost:3002/docs
- **Benutzerverwaltung**: http://localhost:3001/users
- **SAP OData Explorer**: http://localhost:3001/sapodata

## 📦 Port-Konfiguration

| Service | Port | Konfiguration |
|---------|------|---------------|
| API (NestJS) | 3002 | `apps/api/src/main.ts` |
| Web (Next.js) | 3001 | Next.js Auto-Port |
| API URL für Frontend | 3002 | Frontend Components |

## ✨ Features

### 🔗 SAP OData Integration
- **Services Explorer** - Durchsuchen und Laden von SAP OData Services
- **Entity Sets Viewer** - Interaktive Exploration von Entity Sets mit Metadaten
- **Data Explorer** - Abfrage und Anzeige von SAP-Daten mit OData-Parametern
- **Metadata Viewer** - XML-Metadaten-Anzeige und -Analyse
- **SAP Cloud SDK Integration** - Professionelle SAP-Konnektivität
- **Connection Management** - Verwaltung mehrerer SAP-Systemverbindungen
- **AgentDB Caching** - Intelligente Zwischenspeicherung für bessere Performance

#### SAP OData Features im Detail:
- **🗄️ Services Explorer**: Katalog aller verfügbaren SAP OData Services
- **📊 Entity Sets**: Vollständige Entity Sets mit Properties und Key-Feldern
- **📈 Data Explorer**: Interaktive Datenabfrage mit $filter, $top, $skip, etc.
- **📋 Metadata Viewer**: XML-Metadaten-Anzeige mit Syntax-Highlighting
- **☁️ SAP Cloud SDK**: Professionelle SAP-Integration mit Fehlerbehandlung
- **🔗 Connection Management**: Sichere Verwaltung von SAP-Systemverbindungen

### 👥 Benutzerverwaltung
- **Professionelle UI** mit modernen React-Komponenten
- **Dashboard** mit Statistik-Karten (Gesamt, Mit E-Mail, Ohne E-Mail, Kürzlich erstellt)
- **Erweiterte Suche** mit Echtzeit-Filterung
- **Benutzer erstellen** über elegante Modal-Dialoge
- **Tabellen-Ansicht** mit Avataren, Status-Tags und Aktions-Buttons
- **Form-Validierung** mit deutschen Fehlermeldungen
- **Responsive Design** für alle Bildschirmgrößen

### 🛠️ Technische Features
- **Type-Safe API** mit automatisch generierten TypeScript-Typen
- **Real-time Updates** mit modernen React-Patterns
- **OpenAPI/Swagger** Dokumentation
- **CORS** konfiguriert für lokale Entwicklung
- **Validation Pipes** für API-Eingaben
- **Monorepo** mit Turborepo für optimierte Builds
- **SAP Cloud SDK** für professionelle SAP-Integration
- **AgentDB** für intelligente Daten-Zwischenspeicherung

## 🔧 SAP OData Verwendung

### 1. SAP-Verbindung einrichten
```bash
# Navigieren Sie zu: http://localhost:3001/sapodata/connections
# Erstellen Sie eine neue SAP-Verbindung mit:
# - Name: Ihr SAP System
# - Type: SAP
# - Base URL: https://your-sap-system:44301
# - Username & Password
```

### 2. Services erkunden
```bash
# Gehen Sie zu: http://localhost:3001/sapodata
# Klicken Sie "Load Services" um SAP OData Services zu laden
# Beispiel funktionierender Call:
curl -k "https://EVEREST:Welcome1@54.81.18.66:44301/sap/opu/odata/sap/API_BUSINESS_PARTNER/" -H "Accept: application/json"
```

### 3. Entity Sets analysieren
- Klicken Sie auf "Entity Sets" bei einem Service
- Erkunden Sie verfügbare Entity Sets und deren Properties
- Verwenden Sie die Suchfunktion zum Filtern
- Klicken Sie "View Data" für Datenabfrage

## 🛠️ Entwicklung

### SAP OData API-Endpoints
```bash
# Services laden
POST /sapodata/connection/{connectionId}/catalog

# Entity Sets abrufen
POST /sapodata/connection/{connectionId}/service/{serviceName}/metadata/parsed

# Entity Set Daten abfragen
POST /sapodata/connection/{connectionId}/service/{serviceName}/entityset/{entitySetName}

# SAP Cloud SDK verwenden
POST /sapodata/cloud-sdk/execute
```

### OpenAPI-Client aktualisieren
```bash
pnpm gen:client
```

### Neue SAP-Features hinzufügen
1. Controller in `apps/api/src/sap/` erweitern
2. DTOs definieren mit `@nestjs/swagger` Decorators
3. Frontend-Komponenten in `apps/web/src/app/sapodata/` erstellen
4. `pnpm gen:client` ausführen

## 📁 Projekt-Struktur

```
├── apps/
│   ├── api/                 # NestJS Backend
│   │   ├── src/
│   │   │   ├── sap/         # SAP OData Integration
│   │   │   │   ├── sap.controller.ts    # SAP API Endpoints
│   │   │   │   ├── sap.service.ts       # SAP Business Logic
│   │   │   │   ├── services/            # SAP Services
│   │   │   │   │   ├── agentdb.service.ts       # Caching Service
│   │   │   │   │   ├── connection.service.ts    # Connection Management
│   │   │   │   │   ├── sap-cloud-sdk.service.ts # SAP Cloud SDK
│   │   │   │   │   └── sap-cloud-sdk-local.service.ts
│   │   │   │   ├── dto/                 # Data Transfer Objects
│   │   │   │   └── entities/            # Database Entities
│   │   │   ├── users/       # User Management Module
│   │   │   ├── app.module.ts
│   │   │   └── main.ts      # Port 3002 Konfiguration
│   │   └── package.json
│   └── web/                 # Next.js Frontend
│       ├── src/
│       │   └── app/
│       │       ├── sapodata/            # SAP OData UI
│       │       │   ├── page.tsx         # Haupt-Explorer
│       │       │   ├── connections/     # Connection Management
│       │       │   └── components/      # SAP UI Components
│       │       │       ├── EntitySetsViewer.tsx
│       │       │       └── SapCloudSdkViewer.tsx
│       │       ├── users/   # Benutzerverwaltung UI
│       │       ├── layout.tsx
│       │       └── providers.tsx
│       └── package.json
├── packages/
│   └── api-types/           # Generierte API-Typen
├── docs/                    # Dokumentation
│   ├── LOCAL_DEVELOPMENT_GUIDE.md
│   ├── BTP_DEPLOYMENT_GUIDE.md
│   └── ENTITYSETS_IMPLEMENTATION.md
├── pnpm-workspace.yaml
├── turbo.json
└── orval.config.ts          # OpenAPI Code-Generation
```

## 🎨 UI-Komponenten

### SAP OData Explorer
- **Services Explorer**: Übersicht aller verfügbaren SAP OData Services
- **Entity Sets Viewer**: Interaktive Entity Sets mit Properties und Metadaten
- **Data Modal**: Konfigurierbare Datenabfrage mit OData-Parametern
- **Connection Management**: Sichere SAP-Systemverbindungen
- **Search & Filter**: Erweiterte Suchfunktionen für Services und Entity Sets

### Allgemeine UI
- **Responsive Design**: Optimiert für Desktop und Mobile
- **Loading States**: Professionelle Ladezustände
- **Error Handling**: Benutzerfreundliche Fehlermeldungen
- **Status Indicators**: Cache-Status, Datenquellen-Anzeige
- **Interactive Elements**: Hover-Effekte, Click-Feedback

## 🔧 Troubleshooting

### Port bereits belegt
```bash
# API Port 3002 freigeben
lsof -ti:3002 | xargs kill -9

# Frontend Port 3001 freigeben  
lsof -ti:3001 | xargs kill -9
```

### SAP-Verbindungsprobleme
```bash
# Testen Sie die SAP-Verbindung direkt:
curl -k "https://USERNAME:PASSWORD@SAP-HOST:PORT/sap/opu/odata/sap/API_BUSINESS_PARTNER/" -H "Accept: application/json"

# Überprüfen Sie:
# - SAP-System erreichbar
# - Credentials korrekt
# - SSL-Zertifikate (rejectUnauthorized: false für Entwicklung)
```

### Entity Sets Explorer Probleme
- Überprüfen Sie die Browser-Konsole auf Fehler
- Stellen Sie sicher, dass die API auf Port 3002 läuft
- Testen Sie die Metadaten-Endpoints direkt

### Cache-Probleme
```bash
# AgentDB Cache leeren (falls konfiguriert)
# Oder verwenden Sie den Refresh-Button in der UI
```

## 📚 Weitere Ressourcen

- [NestJS Dokumentation](https://docs.nestjs.com)
- [Next.js Dokumentation](https://nextjs.org/docs)
- [SAP Cloud SDK Dokumentation](https://sap.github.io/cloud-sdk/)
- [SAP OData Dokumentation](https://help.sap.com/docs/SAP_NETWEAVER_AS_ABAP_FOR_SOH/68bf513362174d54b58cddec28794093/59283fc4528f486b83b1a58a4f1063c0.html)
- [AgentDB Dokumentation](https://docs.agentdb.dev)
- [Orval OpenAPI Generator](https://orval.dev/)

## 🚀 Deployment

Siehe detaillierte Deployment-Guides:
- [Lokale Entwicklung](./LOCAL_DEVELOPMENT_GUIDE.md)
- [BTP Deployment](./BTP_DEPLOYMENT_GUIDE.md)
- [Entity Sets Implementation](./ENTITYSETS_IMPLEMENTATION.md)

# NestJS + Next.js + Ant Design Monorepo

Ein modernes Full-Stack-Projekt mit professioneller Benutzerverwaltung und schöner UI.

## 🏗️ Architektur

- **Backend**: NestJS API (`apps/api`) – OpenAPI via `@nestjs/swagger`
- **Frontend**: Next.js + React + Ant Design + TanStack Query (`apps/web`)
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
# Terminal 1: API starten (Port 3001)
pnpm -F @acme/api dev

# Terminal 2: OpenAPI-Client generieren
pnpm gen:client

# Terminal 3: Web-Frontend starten (Port 3000)
pnpm -F web dev
```

## 🌐 URLs

- **Frontend**: http://localhost:3000
- **API**: http://localhost:3001
- **Swagger Docs**: http://localhost:3001/docs
- **Benutzerverwaltung**: http://localhost:3000/users

## 📦 Port-Konfiguration

| Service | Port | Konfiguration |
|---------|------|---------------|
| API (NestJS) | 3001 | `apps/api/src/main.ts` |
| Web (Next.js) | 3000 | Next.js Standard |
| API URL für Frontend | 3001 | `apps/web/.env.local` |

## ✨ Features

### Benutzerverwaltung
- **Professionelle UI** mit Ant Design Komponenten
- **Dashboard** mit Statistik-Karten (Gesamt, Mit E-Mail, Ohne E-Mail, Kürzlich erstellt)
- **Erweiterte Suche** mit Echtzeit-Filterung
- **Benutzer erstellen** über elegante Modal-Dialoge
- **Tabellen-Ansicht** mit Avataren, Status-Tags und Aktions-Buttons
- **Form-Validierung** mit deutschen Fehlermeldungen
- **Responsive Design** für alle Bildschirmgrößen

### Technische Features
- **Type-Safe API** mit automatisch generierten TypeScript-Typen
- **Real-time Updates** mit TanStack Query
- **OpenAPI/Swagger** Dokumentation
- **CORS** konfiguriert für lokale Entwicklung
- **Validation Pipes** für API-Eingaben
- **Monorepo** mit Turborepo für optimierte Builds

## 🛠️ Entwicklung

### OpenAPI-Client aktualisieren
```bash
pnpm gen:client
```

### Neue API-Endpoints hinzufügen
1. Controller in `apps/api/src/` erweitern
2. DTOs definieren mit `@nestjs/swagger` Decorators
3. `pnpm gen:client` ausführen
4. Neue Hooks in Frontend verwenden

### Neue UI-Komponenten
- Ant Design Komponenten verwenden: https://ant.design/components/
- Bestehende Patterns in `apps/web/src/app/users/` folgen
- TanStack Query für API-Calls nutzen

## 📁 Projekt-Struktur

```
├── apps/
│   ├── api/                 # NestJS Backend
│   │   ├── src/
│   │   │   ├── users/       # User Management Module
│   │   │   ├── app.module.ts
│   │   │   └── main.ts      # Port 3001 Konfiguration
│   │   └── package.json
│   └── web/                 # Next.js Frontend
│       ├── src/
│       │   └── app/
│       │       ├── users/   # Benutzerverwaltung UI
│       │       ├── layout.tsx
│       │       └── providers.tsx
│       ├── .env.local       # API URL Konfiguration
│       └── package.json
├── packages/
│   └── api-types/           # Generierte API-Typen
├── pnpm-workspace.yaml
├── turbo.json
└── orval.config.ts          # OpenAPI Code-Generation
```

## 🎨 UI-Komponenten

Das Projekt verwendet **Ant Design** für eine professionelle und konsistente Benutzeroberfläche:

- **Statistik-Karten**: `Statistic` Komponente für Dashboard-Metriken
- **Tabellen**: `Table` mit Sortierung, Pagination und Custom-Rendering
- **Modals**: `Modal` + `Form` für Benutzer-Erstellung
- **Suche**: `Input.Search` mit Echtzeit-Filterung
- **Icons**: `@ant-design/icons` für visuelle Elemente
- **Status-Tags**: `Tag` Komponente für Benutzer-Status
- **Avatare**: `Avatar` mit Benutzer-Initialen

## 🔧 Troubleshooting

### Port bereits belegt
```bash
# Andere Prozesse auf Port 3001 beenden
lsof -ti:3001 | xargs kill -9

# Andere Prozesse auf Port 3000 beenden  
lsof -ti:3000 | xargs kill -9
```

### API-Client nicht aktuell
```bash
pnpm gen:client
```

### CORS-Fehler
- Überprüfe `apps/api/src/main.ts` CORS-Konfiguration
- Stelle sicher, dass Frontend-URL korrekt ist

## 📚 Weitere Ressourcen

- [NestJS Dokumentation](https://docs.nestjs.com)
- [Next.js Dokumentation](https://nextjs.org/docs)
- [Ant Design Komponenten](https://ant.design/components/)
- [TanStack Query](https://tanstack.com/query/latest)
- [Orval OpenAPI Generator](https://orval.dev/)

# Next.js Frontend mit Ant Design

Modernes Frontend für die Benutzerverwaltung mit professioneller UI und Ant Design Komponenten.

## 🚀 Schnellstart

```bash
# Aus dem Root-Verzeichnis
pnpm -F web dev

# Oder direkt im web-Ordner
cd apps/web
pnpm dev
```

## 🌐 URLs

- **Frontend**: http://localhost:3000
- **Benutzerverwaltung**: http://localhost:3000/users

## 📦 Port-Konfiguration

Das Frontend läuft standardmäßig auf **Port 3000** (Next.js Standard).

### API-Verbindung
Die API-URL ist in `.env.local` konfiguriert:
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## ✨ Features

### 🎨 Benutzerverwaltung UI
- **Dashboard** mit Statistik-Karten (Gesamt, Mit E-Mail, Ohne E-Mail, Kürzlich erstellt)
- **Professionelle Tabelle** mit Benutzer-Avataren und Status-Tags
- **Erweiterte Suche** mit Echtzeit-Filterung über Namen, E-Mail und ID
- **Modal-Dialog** für Benutzer-Erstellung mit Validierung
- **Responsive Design** für alle Bildschirmgrößen
- **Deutsche Lokalisierung** aller UI-Texte

### 🛠️ Technische Features
- **Ant Design** für konsistente und professionelle UI
- **TanStack Query** für effizientes API-State-Management
- **TypeScript** mit automatisch generierten API-Typen
- **Real-time Updates** nach CRUD-Operationen
- **Form-Validierung** mit benutzerfreundlichen Fehlermeldungen

## 🎨 UI-Komponenten

### Ant Design Komponenten im Einsatz

| Komponente | Verwendung | Datei |
|------------|------------|-------|
| `Statistic` | Dashboard-Statistiken | `users/page.tsx` |
| `Table` | Benutzer-Tabelle mit Pagination | `users/page.tsx` |
| `Modal` + `Form` | Benutzer-Erstellung | `users/CreateUserModal.tsx` |
| `Input.Search` | Echtzeit-Suche | `users/page.tsx` |
| `Avatar` | Benutzer-Avatare | `users/page.tsx` |
| `Tag` | Status-Anzeige | `users/page.tsx` |
| `Button` | Aktions-Buttons | Überall |
| `Card` | Layout-Container | `users/page.tsx` |

### Icons
- `UserOutlined` - Benutzer-Icons
- `MailOutlined` - E-Mail-Icons
- `SearchOutlined` - Such-Icons
- `PlusOutlined` - Hinzufügen-Icons

## 🏗️ Architektur

### Ordner-Struktur
```
src/
├── app/
│   ├── layout.tsx           # Root-Layout mit Ant Design
│   ├── providers.tsx        # TanStack Query Provider
│   ├── globals.css          # Globale Styles
│   └── users/               # Benutzerverwaltung
│       ├── page.tsx         # Haupt-Benutzerseite
│       └── CreateUserModal.tsx  # Modal für Benutzer-Erstellung
```

### State Management
- **TanStack Query** für Server-State (API-Calls)
- **React State** für lokale UI-State (Modals, Suche)
- **Automatische Invalidierung** nach Mutations

## 🛠️ Entwicklung

### Neue Seiten hinzufügen
```typescript
// src/app/products/page.tsx
'use client';
import { Card, Table } from 'antd';

export default function ProductsPage() {
  return (
    <Card title="Produkte">
      <Table dataSource={[]} columns={[]} />
    </Card>
  );
}
```

### API-Hooks verwenden
```typescript
import { useGetUsers, useCreateUser } from '@acme/api-types';

function MyComponent() {
  const { data: users, isLoading } = useGetUsers();
  const createUser = useCreateUser();
  
  const handleCreate = (userData) => {
    createUser.mutate(userData);
  };
}
```

### Ant Design Theming
```typescript
// src/app/layout.tsx
import { ConfigProvider } from 'antd';
import deDE from 'antd/locale/de_DE';

export default function RootLayout({ children }) {
  return (
    <ConfigProvider locale={deDE}>
      {children}
    </ConfigProvider>
  );
}
```

## 🎯 Benutzer-Features

### Dashboard-Statistiken
- **Gesamt Benutzer**: Zeigt die Gesamtanzahl aller Benutzer
- **Mit E-Mail**: Anzahl Benutzer mit E-Mail-Adresse
- **Ohne E-Mail**: Anzahl Benutzer ohne E-Mail-Adresse
- **Kürzlich erstellt**: Verhältnis der kürzlich erstellten Benutzer

### Such-Funktionalität
- **Multi-Wort-Suche**: Unterstützt mehrere Suchbegriffe
- **Echtzeit-Filterung**: Sofortige Ergebnisse beim Tippen
- **Durchsucht**: Namen, E-Mail-Adressen und IDs
- **Filter-Anzeige**: Zeigt aktuelle Suchkriterien an

### Benutzer-Tabelle
- **Avatare**: Automatisch generierte Initialen
- **Status-Tags**: Visueller Status (Vollständig/Unvollständig)
- **Sortierung**: Klickbare Spalten-Header
- **Pagination**: Automatische Seiteneinteilung
- **Aktionen**: Bearbeiten und Löschen pro Zeile

### Modal-Formulare
- **Validierung**: E-Mail-Format-Prüfung
- **Fehlerbehandlung**: Deutsche Fehlermeldungen
- **Auto-Reset**: Formular wird nach Erfolg zurückgesetzt
- **Loading-States**: Visuelles Feedback während API-Calls

## 🔧 Konfiguration

### Environment Variables
```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Ant Design Konfiguration
```typescript
// next.config.js
module.exports = {
  transpilePackages: ['antd'],
  // Weitere Konfiguration...
};
```

## 🧪 Testing

### Component Testing
```bash
# Jest + React Testing Library
pnpm test

# Watch Mode
pnpm test:watch
```

### E2E Testing
```bash
# Playwright (falls konfiguriert)
pnpm test:e2e
```

## 🚀 Build & Deployment

### Production Build
```bash
pnpm build
pnpm start
```

### Static Export
```bash
pnpm build
pnpm export
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN pnpm install
COPY . .
RUN pnpm build
EXPOSE 3000
CMD ["pnpm", "start"]
```

## 🔍 Debugging

### Next.js Debug Mode
```bash
DEBUG=* pnpm dev
```

### React DevTools
- Installiere die [React DevTools](https://react.dev/link/react-devtools) Browser-Extension
- Öffne die Browser-Entwicklertools
- Nutze den "Components" und "Profiler" Tab

### TanStack Query DevTools
Die Query DevTools sind automatisch in der Entwicklung aktiviert.

## 📱 Responsive Design

Das UI ist für alle Bildschirmgrößen optimiert:
- **Desktop**: Vollständige Tabellen-Ansicht
- **Tablet**: Angepasste Spalten-Breiten
- **Mobile**: Responsive Karten-Layout

## 🌐 Internationalisierung

Aktuell auf Deutsch konfiguriert. Für weitere Sprachen:
```typescript
import { ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';

// Sprache ändern
<ConfigProvider locale={enUS}>
```

## 📚 Weitere Ressourcen

- [Next.js Dokumentation](https://nextjs.org/docs)
- [Ant Design Komponenten](https://ant.design/components/)
- [TanStack Query](https://tanstack.com/query/latest)
- [React Hook Form](https://react-hook-form.com/) (falls verwendet)
- [Ant Design Icons](https://ant.design/components/icon/)

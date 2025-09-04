# NestJS API Backend

Backend-Service für die Benutzerverwaltung mit OpenAPI/Swagger Dokumentation.

## 🚀 Schnellstart

```bash
# Aus dem Root-Verzeichnis
pnpm -F @acme/api dev

# Oder direkt im api-Ordner
cd apps/api
pnpm dev
```

## 🌐 URLs

- **API Server**: http://localhost:3001
- **Swagger UI**: http://localhost:3001/docs
- **OpenAPI JSON**: http://localhost:3001/docs-json

## 📦 Port-Konfiguration

Die API läuft standardmäßig auf **Port 3001**. Dies ist in `src/main.ts` konfiguriert:

```typescript
const port = process.env.PORT || 3001;
```

Um einen anderen Port zu verwenden:
```bash
PORT=4000 pnpm dev
```

## 🏗️ Architektur

### Module
- **AppModule**: Haupt-Anwendungsmodul
- **UsersModule**: Benutzerverwaltung mit CRUD-Operationen

### Features
- **OpenAPI/Swagger**: Automatische API-Dokumentation
- **Validation Pipes**: Eingabe-Validierung mit class-validator
- **CORS**: Konfiguriert für Frontend-Kommunikation
- **DTOs**: Type-safe Data Transfer Objects

## 🛠️ API-Endpoints

### Benutzer-Verwaltung (`/users`)

| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| GET | `/users` | Alle Benutzer abrufen |
| POST | `/users` | Neuen Benutzer erstellen |
| GET | `/users/:id` | Benutzer nach ID abrufen |
| PUT | `/users/:id` | Benutzer aktualisieren |
| DELETE | `/users/:id` | Benutzer löschen |

### Swagger Dokumentation
Besuche http://localhost:3001/docs für die interaktive API-Dokumentation.

## 📝 Neue Endpoints hinzufügen

1. **Controller erweitern** (`src/users/users.controller.ts`):
```typescript
@Get('search')
@ApiOperation({ summary: 'Benutzer suchen' })
async searchUsers(@Query('q') query: string) {
  return this.usersService.search(query);
}
```

2. **DTO definieren** (`src/users/search-user.dto.ts`):
```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class SearchUserDto {
  @ApiProperty({ description: 'Suchbegriff' })
  @IsString()
  @IsOptional()
  q?: string;
}
```

3. **Service-Methode implementieren** (`src/users/users.service.ts`):
```typescript
async search(query: string): Promise<User[]> {
  // Implementierung hier
}
```

4. **OpenAPI-Client aktualisieren**:
```bash
# Aus dem Root-Verzeichnis
pnpm gen:client
```

## 🔧 Konfiguration

### CORS
CORS ist für lokale Entwicklung konfiguriert (`src/main.ts`):
```typescript
app.enableCors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true,
});
```

### Validation
Globale Validation Pipes sind aktiviert:
```typescript
app.useGlobalPipes(new ValidationPipe({ 
  whitelist: true, 
  transform: true 
}));
```

## 🧪 Tests

```bash
# Unit Tests
pnpm test

# E2E Tests
pnpm test:e2e

# Test Coverage
pnpm test:cov

# Watch Mode
pnpm test:watch
```

## 📁 Projekt-Struktur

```
src/
├── users/                   # Benutzer-Modul
│   ├── users.controller.ts  # REST-Endpoints
│   ├── users.service.ts     # Business-Logik
│   ├── users.module.ts      # Modul-Definition
│   ├── user.dto.ts          # Response-DTO
│   └── create-user.dto.ts   # Request-DTO
├── app.controller.ts        # Root-Controller
├── app.service.ts           # Root-Service
├── app.module.ts            # Haupt-Modul
└── main.ts                  # Bootstrap & Konfiguration
```

## 🔍 Debugging

### Logs aktivieren
```bash
# Debug-Modus
DEBUG=* pnpm dev

# Nur NestJS-Logs
DEBUG=nest:* pnpm dev
```

### Swagger JSON exportieren
```bash
curl http://localhost:3001/docs-json > api-spec.json
```

## 🚀 Deployment

### Production Build
```bash
pnpm build
pnpm start:prod
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN pnpm install --only=production
COPY dist ./dist
EXPOSE 3001
CMD ["node", "dist/main"]
```

## 📚 Weitere Ressourcen

- [NestJS Dokumentation](https://docs.nestjs.com)
- [Swagger/OpenAPI](https://swagger.io/specification/)
- [Class Validator](https://github.com/typestack/class-validator)
- [NestJS Swagger](https://docs.nestjs.com/openapi/introduction)

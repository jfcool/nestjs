# PostgreSQL Database Setup für NestJS Application

## Übersicht

Dieses Projekt verwendet eine PostgreSQL-Datenbank mit pgvector und pg_trgm Extensions für Vektorspeicherung und Text-Ähnlichkeitssuche. Die Implementierung verwendet Drizzle ORM und Docker Compose für die Datenbankbereitstellung.

## Setup-Komponenten

### 1. Docker Compose Konfiguration
- **PostgreSQL Container**: `nestjs-postgres` mit pgvector Extension
- **pgAdmin Container**: `nestjs-pgadmin` für Datenbank-Management
- **Ollama Container**: `nestjs-ollama` für AI-Embeddings
- **Datenbank**: `nestjs_app`
- **Benutzer**: `postgres`
- **Passwort**: `joe`
- **PostgreSQL Port**: `5432`
- **pgAdmin Port**: `8080`
- **Ollama Port**: `11434`
- **Volumes**: Persistente Speicherung in `postgres_data`, `pgadmin_data`, `ollama_data`
- **Netzwerk**: `nestjs-network` für Container-Kommunikation

### 2. PostgreSQL Extensions
- **pgvector**: Für Vector-Embeddings (768 Dimensionen)
- **pg_trgm**: Für Text-Ähnlichkeitssuche und Fuzzy Matching

### 3. Drizzle ORM Konfiguration
- **Migrations**: Automatische Datenbank-Migration bei Anwendungsstart
- **Schema**: Definiert in `apps/api/src/database/schema/`
- **Haupttabellen**:
  - `users`: Benutzer mit Rollen und Berechtigungen
  - `documents`: Dokument-Metadaten
  - `chunks`: Text-Chunks mit Vector-Embeddings
  - `conversations`: Chat-Konversationen
  - `messages`: Chat-Nachrichten
  - `sap_connections`: SAP OData Verbindungen

### 4. API Endpunkte

#### User Management
- `GET /users` - Alle User abrufen
- `GET /users/:id` - Einzelnen User abrufen
- `POST /users` - Neuen User erstellen
- `PUT /users/:id` - User aktualisieren
- `DELETE /users/:id` - User löschen

#### Documents
- `GET /documents` - Alle Dokumente abrufen
- `GET /documents/search` - Dokumente durchsuchen (Hybrid: Keyword + Vector)
- `POST /documents/index` - Dokumente neu indexieren

#### Authentication
- `POST /auth/login` - Benutzer anmelden
- `POST /auth/register` - Neuen Benutzer registrieren
- `GET /auth/me` - Aktuellen Benutzer abrufen

#### Chat
- `GET /chat/conversations` - Konversationen abrufen
- `POST /chat/messages` - Nachricht senden (mit RAG)

## Verwendung

### Datenbank starten
```bash
docker-compose up -d
```

### API starten
```bash
# Alle Projekte (API + Web)
pnpm dev

# Nur API
cd apps/api
pnpm dev
```

### Drizzle Studio starten (Database UI)
```bash
cd apps/api
pnpm run db:studio
# Öffnet: https://local.drizzle.studio
```

### API testen
```bash
# Alle User abrufen
curl -X GET http://localhost:3001/users

# Neuen User erstellen
curl -X POST http://localhost:3001/users \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "email": "test@example.com", "password": "password123"}'

# Login
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin"}'
```

## Datenbankschema

### Haupttabellen

#### Users
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Documents & Chunks (mit pgvector)
```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_type VARCHAR(50),
    file_size INTEGER,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    embedding vector(768), -- pgvector für Embeddings
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index für Vector-Ähnlichkeitssuche
CREATE INDEX idx_chunks_embedding ON chunks USING ivfflat (embedding vector_cosine_ops);
```

## Initial Seed Data

Bei der ersten Migration werden automatisch 2 Test-User erstellt:
- **admin** / **admin** (System Administrator)
- **everest** / **everest** (Everest User - Chat & SAP Access)

## pgAdmin Datenbank-Management

### Zugang zu pgAdmin
- **URL**: http://localhost:8080
- **E-Mail**: admin@admin.com
- **Passwort**: admin

### Automatische Datenbankverbindung
pgAdmin ist bereits vorkonfiguriert mit einer automatischen Verbindung zur PostgreSQL-Datenbank:
- **Server Name**: "NestJS PostgreSQL"
- **Host**: db (Container-Name)
- **Port**: 5432
- **Datenbank**: nestjs_app
- **Benutzer**: postgres
- **Passwort**: joe

Die Verbindung wird automatisch beim ersten Start von pgAdmin eingerichtet.

## Migrations

### Migrations ausführen
```bash
cd apps/api
pnpm run db:migrate
```

### Migration generieren (bei Schema-Änderungen)
```bash
cd apps/api
pnpm run db:generate
```

## Database Management Tools

### Drizzle Studio
- **URL**: https://local.drizzle.studio
- **Features**: 
  - Visuelles Schema-Design
  - Daten bearbeiten
  - Queries ausführen
  - Migrations verwalten

### pgAdmin
- **URL**: http://localhost:8080
- **E-Mail**: admin@admin.com
- **Passwort**: admin
- **Features**: Vollständiges PostgreSQL-Management

## Swagger Dokumentation

Die API-Dokumentation ist verfügbar unter: http://localhost:3001/docs

## Technische Details

- **Framework**: NestJS
- **ORM**: Drizzle ORM
- **Datenbank**: PostgreSQL mit pgvector & pg_trgm
- **Container**: Docker Compose
- **Validierung**: class-validator
- **Transformation**: class-transformer
- **API-Dokumentation**: Swagger/OpenAPI
- **AI Embeddings**: Ollama (nomic-embed-text model)
- **Vector Search**: pgvector (768 dimensions)
- **Text Search**: pg_trgm (Fuzzy matching)

## Wichtige Befehle

```bash
# Datenbank Backup erstellen
docker exec nestjs-postgres pg_dump -U postgres nestjs_app > backup.sql

# Datenbank wiederherstellen
docker exec -i nestjs-postgres psql -U postgres nestjs_app < backup.sql

# Extensions prüfen
docker exec nestjs-postgres psql -U postgres -d nestjs_app -c "SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector', 'pg_trgm');"

# Dokumente neu indexieren (nach Ollama-Model Download)
cd apps/api
pnpm exec tsx reindex-now.ts
```

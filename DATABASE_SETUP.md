# PostgreSQL Database Setup für NestJS User Management

## Übersicht

Dieses Projekt wurde erfolgreich mit einer PostgreSQL-Datenbank erweitert, um User-Daten persistent zu speichern. Die Implementierung verwendet TypeORM als ORM und Docker Compose für die Datenbankbereitstellung.

## Setup-Komponenten

### 1. Docker Compose Konfiguration
- **PostgreSQL Container**: `pgvector-db` mit PostgreSQL 15.4 + pgvector Extension
- **pgAdmin Container**: `pgadmin-ui` für Datenbank-Management
- **Datenbank**: `nestjs_app`
- **Benutzer**: `postgres`
- **Passwort**: `joe`
- **PostgreSQL Port**: `5432`
- **pgAdmin Port**: `8080`
- **Volumes**: Persistente Speicherung in `pgdata` und `pgadmin-data`
- **Netzwerk**: `postgres-network` für Container-Kommunikation

### 2. TypeORM Konfiguration
- **Entity**: `User` mit Feldern: id, name, email, createdAt, updatedAt
- **Synchronize**: Aktiviert in Development (automatische Schema-Erstellung)
- **Logging**: Aktiviert in Development

### 3. User API Endpunkte
- `GET /users` - Alle User abrufen
- `GET /users/:id` - Einzelnen User abrufen
- `POST /users` - Neuen User erstellen
- `PUT /users/:id` - User aktualisieren
- `DELETE /users/:id` - User löschen

## Verwendung

### Datenbank starten
```bash
docker-compose up -d
```

### API starten
```bash
cd apps/api
pnpm run dev
```

### API testen
```bash
# Alle User abrufen
curl -X GET http://localhost:3002/users

# Neuen User erstellen
curl -X POST http://localhost:3002/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Test User", "email": "test@example.com"}'

# Einzelnen User abrufen
curl -X GET http://localhost:3002/users/1
```

## Datenbankschema

### User Tabelle
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Seeding

Beim ersten Start der Anwendung werden automatisch 5 Test-User erstellt:
- Max Mustermann (max@example.com)
- Erika Musterfrau (erika@example.com)
- Fränki (keine E-Mail)
- Anna Schmidt (anna.schmidt@test.de)
- Peter Müller (peter.mueller@example.org)

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

## Swagger Dokumentation

Die API-Dokumentation ist verfügbar unter: http://localhost:3002/docs

## Technische Details

- **Framework**: NestJS
- **ORM**: TypeORM
- **Datenbank**: PostgreSQL 15.4 mit pgvector
- **Container**: Docker Compose
- **Validierung**: class-validator
- **Transformation**: class-transformer
- **API-Dokumentation**: Swagger/OpenAPI

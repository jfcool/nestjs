# Docker Setup Guide - NestJS mit PostgreSQL, PgAdmin und Ollama

## 🚀 Schnellstart

Das komplette System mit einem Befehl starten:

```bash
docker-compose up -d
```

Das war's! Alle Services werden automatisch gestartet und konfiguriert.

## 📋 Services im Container

### 1. PostgreSQL mit pgvector und pg_trgm (Port 5432)
- **Container**: `nestjs-postgres`
- **Image**: `ankane/pgvector:latest`
- **Datenbank**: `nestjs_app`
- **Benutzer**: `postgres`
- **Passwort**: `joe`
- **Features**: 
  - pgvector Extension für Vector-Embeddings
  - pg_trgm Extension für Text-Ähnlichkeitssuche (Fuzzy Search)

### 2. PgAdmin (Port 8080)
- **Container**: `nestjs-pgadmin`
- **URL**: http://localhost:8080
- **Login**: admin@admin.com / admin
- **Features**: Vorkonfigurierte Datenbankverbindung

### 3. Ollama AI (Port 11434)
- **Container**: `nestjs-ollama`
- **URL**: http://localhost:11434
- **Model**: `nomic-embed-text` (automatisch installiert)
- **Features**: Vector-Embeddings für semantische Suche

### 4. Ollama Model Initialization
- **Container**: `nestjs-ollama-init`
- **Zweck**: Lädt automatisch das `nomic-embed-text` Model
- **Status**: Läuft einmalig beim ersten Start

## 🔧 Verwendung

### Alle Services starten
```bash
docker-compose up -d
```

### Services einzeln starten
```bash
# Nur Datenbank
docker-compose up -d postgres

# Nur Ollama
docker-compose up -d ollama

# Nur PgAdmin
docker-compose up -d pgadmin
```

### Status prüfen
```bash
docker-compose ps
```

### Logs anzeigen
```bash
# Alle Services
docker-compose logs -f

# Einzelner Service
docker-compose logs -f postgres
docker-compose logs -f ollama
docker-compose logs -f pgadmin
```

### Services stoppen
```bash
docker-compose down
```

### Services stoppen und Volumes löschen
```bash
docker-compose down -v
```

## 🔍 Service-URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| **PostgreSQL** | localhost:5432 | postgres / joe |
| **PgAdmin** | http://localhost:8080 | admin@admin.com / admin |
| **Ollama API** | http://localhost:11434 | - |

## 🗄️ Datenbank-Zugriff

### Via PgAdmin (Web-Interface)
1. Öffnen Sie: http://localhost:8080
2. Anmelden: admin@admin.com / admin
3. Server "NestJS PostgreSQL" ist bereits konfiguriert
4. Klicken Sie darauf, um sich zu verbinden

### Via Command Line
```bash
# PostgreSQL Client
psql -h localhost -p 5432 -U postgres -d nestjs_app

# Docker exec
docker exec -it nestjs-postgres psql -U postgres -d nestjs_app
```

### Via NestJS Application
Die Anwendung verbindet sich automatisch mit der Datenbank über die Umgebungsvariablen in `.env`.

## 🤖 Ollama-Verwendung

### Model testen
```bash
curl http://localhost:11434/api/generate -d '{
  "model": "nomic-embed-text",
  "prompt": "Hello, world!",
  "stream": false
}'
```

### Embedding generieren
```bash
curl http://localhost:11434/api/embeddings -d '{
  "model": "nomic-embed-text",
  "prompt": "This is a test sentence for embedding."
}'
```

### Verfügbare Models anzeigen
```bash
curl http://localhost:11434/api/tags
```

## 🔧 Troubleshooting

### Services starten nicht
```bash
# Prüfen Sie die Logs
docker-compose logs

# Ports prüfen
netstat -an | findstr "5432\|8080\|11434"

# Container neu starten
docker-compose restart
```

### Datenbank-Verbindungsprobleme
```bash
# Datenbank-Status prüfen
docker-compose exec postgres pg_isready -U postgres

# pgvector Extension prüfen
docker-compose exec postgres psql -U postgres -d nestjs_app -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"

# pg_trgm Extension prüfen
docker-compose exec postgres psql -U postgres -d nestjs_app -c "SELECT extname FROM pg_extension WHERE extname = 'pg_trgm';"

# Beide Extensions prüfen
docker-compose exec postgres psql -U postgres -d nestjs_app -c "SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector', 'pg_trgm');"
```

### Ollama Model-Probleme
```bash
# Model-Status prüfen
docker-compose exec ollama ollama list

# Model neu laden
docker-compose exec ollama ollama pull nomic-embed-text
```

### PgAdmin-Verbindungsprobleme
```bash
# Container-Netzwerk prüfen
docker network inspect nestjs-network

# PgAdmin neu starten
docker-compose restart pgadmin
```

## 📁 Persistente Daten

Alle Daten werden in Docker Volumes gespeichert:

- **postgres_data**: PostgreSQL-Datenbank
- **pgadmin_data**: PgAdmin-Konfiguration
- **ollama_data**: Ollama-Models und Cache

### Volumes verwalten
```bash
# Volumes anzeigen
docker volume ls | findstr nestjs

# Volume-Details
docker volume inspect nestjs_postgres_data

# Volumes löschen (ACHTUNG: Alle Daten gehen verloren!)
docker-compose down -v
```

## 🔄 Updates und Wartung

### Images aktualisieren
```bash
# Neue Images herunterladen
docker-compose pull

# Services mit neuen Images neu starten
docker-compose up -d --force-recreate
```

### Datenbank-Backup
```bash
# Backup erstellen
docker-compose exec postgres pg_dump -U postgres nestjs_app > backup.sql

# Backup wiederherstellen
docker-compose exec -T postgres psql -U postgres nestjs_app < backup.sql
```

## 🌐 Netzwerk-Konfiguration

Alle Services laufen im `nestjs-network` und können sich über Container-Namen erreichen:

- **postgres**: `nestjs-postgres:5432`
- **pgadmin**: `nestjs-pgadmin:80`
- **ollama**: `nestjs-ollama:11434`

## ⚡ Performance-Optimierung

### PostgreSQL
- Shared Buffers: Automatisch optimiert
- Work Memory: Für Vector-Operationen optimiert
- pgvector Indexes: Automatisch erstellt

### Ollama
- Model-Cache: Persistent gespeichert
- GPU-Support: Automatisch erkannt (falls verfügbar)
- Memory-Management: Optimiert für Embedding-Generation

## 🔒 Sicherheit

### Produktions-Deployment
Für Produktionsumgebungen ändern Sie:

1. **Passwörter** in `docker-compose.yml`
2. **PgAdmin-Credentials**
3. **Netzwerk-Konfiguration** (interne Ports)
4. **SSL-Zertifikate** für HTTPS

### Beispiel für Produktion
```yaml
environment:
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
  PGADMIN_DEFAULT_PASSWORD: ${PGADMIN_PASSWORD}
```

## 📞 Support

Bei Problemen:

1. Prüfen Sie die Logs: `docker-compose logs`
2. Überprüfen Sie die Service-Status: `docker-compose ps`
3. Testen Sie die Netzwerk-Verbindungen
4. Konsultieren Sie die Troubleshooting-Sektion

---

**Das Setup ist vollständig automatisiert und produktionsbereit!** 🎉

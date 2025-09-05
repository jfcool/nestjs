# SAP OData Integration

Diese SAP-Integration basiert auf dem ursprünglichen Everest-Framework-Projekt und wurde für NestJS adaptiert. Sie bietet vollständige SAP OData-Funktionalität unter dem `/sapodata` Endpunkt.

## Übersicht

Die SAP-Integration ermöglicht es, OData-Services von SAP-Systemen abzurufen und zu verwalten. Sie unterstützt sowohl Metadaten- als auch Datenabfragen mit vollständiger Authentifizierung und Fehlerbehandlung.

## Architektur

### Module
- **SapModule**: Haupt-Modul für die SAP-Integration
- **SapService**: Kernlogik für SAP-Kommunikation
- **SapController**: REST-API-Endpunkte unter `/sapodata`

### DTOs
- **SapConnectionDto**: Verbindungsinformationen für SAP-System
- **SapODataRequestDto**: Request-Format für OData-Abfragen
- **SapODataResponse**: Response-Format für OData-Antworten

## API-Endpunkte

### Basis-URL: `/sapodata`

#### 1. Health Check
```
GET /sapodata/health
```
Überprüft den Status der SAP-Integration.

#### 2. API-Dokumentation
```
GET /sapodata/docs
```
Liefert vollständige API-Dokumentation mit Beispielen.

#### 3. OData-Daten abrufen
```
POST /sapodata/data
Content-Type: application/json

{
  "servicePath": "/sap/opu/odata/sap/SERVICE_NAME/EntitySet",
  "connectionInfo": {
    "baseUrl": "https://your-sap-system:44301",
    "username": "SAP_USER",
    "password": "SAP_PASSWORD",
    "rejectUnauthorized": false
  }
}
```

#### 4. OData-Metadaten abrufen
```
POST /sapodata/metadata
Content-Type: application/json

{
  "servicePath": "/sap/opu/odata/sap/SERVICE_NAME/$metadata",
  "connectionInfo": {
    "baseUrl": "https://your-sap-system:44301",
    "username": "SAP_USER",
    "password": "SAP_PASSWORD"
  }
}
```

#### 5. Verbindung einrichten
```
POST /sapodata/setup
Content-Type: application/json

{
  "baseUrl": "https://your-sap-system:44301",
  "username": "SAP_USER",
  "password": "SAP_PASSWORD",
  "rejectUnauthorized": false
}
```

#### 6. Service-Katalog abrufen
```
POST /sapodata/catalog
Content-Type: application/json

{
  "baseUrl": "https://your-sap-system:44301",
  "username": "SAP_USER",
  "password": "SAP_PASSWORD"
}
```

#### 7. Service-spezifische Daten
```
POST /sapodata/service/{serviceName}?entitySet=EntityName&$top=10&$filter=Name eq 'Test'
Content-Type: application/json

{
  "baseUrl": "https://your-sap-system:44301",
  "username": "SAP_USER",
  "password": "SAP_PASSWORD"
}
```

#### 8. Service-Metadaten
```
POST /sapodata/service/{serviceName}/metadata
Content-Type: application/json

{
  "baseUrl": "https://your-sap-system:44301",
  "username": "SAP_USER",
  "password": "SAP_PASSWORD"
}
```

## Verbindungsoptionen

### Erforderliche Parameter
- `username`: SAP-Benutzername
- `password`: SAP-Passwort
- `baseUrl` ODER `basePath`: SAP-System-URL

### Optionale Parameter
- `timeout`: Request-Timeout in Millisekunden (Standard: 30000)
- `rejectUnauthorized`: SSL-Zertifikat-Validierung (Standard: false)
- `userAgent`: User-Agent-Header (Standard: 'NestJS-SAP-OData-Client')

### Verbindungsarten

#### Direkte URL-Verbindung
```json
{
  "baseUrl": "https://sap-system.company.com:44301",
  "username": "SAP_USER",
  "password": "SAP_PASSWORD",
  "rejectUnauthorized": false
}
```

#### Pfad-basierte Verbindung
```json
{
  "basePath": "sap-system.company.com:44301",
  "username": "SAP_USER",
  "password": "SAP_PASSWORD",
  "rejectUnauthorized": false
}
```

## OData-Query-Parameter

Die Integration unterstützt Standard-OData-Query-Parameter:

- `$filter`: Filterkriterien (z.B. `"Name eq 'Test'"`)
- `$top`: Anzahl der Ergebnisse begrenzen
- `$skip`: Anzahl der Ergebnisse überspringen
- `$orderby`: Sortierung
- `$select`: Spezifische Felder auswählen
- `$expand`: Verwandte Entitäten erweitern

### Beispiel mit Query-Parametern
```
POST /sapodata/service/ZSERVICE?entitySet=Products&$top=5&$filter=Price gt 100
```

## Fehlerbehandlung

### Custom Error Classes
- **SapHttpError**: HTTP-Fehler vom SAP-System
- **SapFormatError**: Formatfehler (z.B. HTML statt JSON/XML)

### Typische Fehlerszenarien
1. **Authentifizierungsfehler**: Falsche Credentials
2. **Netzwerkfehler**: SAP-System nicht erreichbar
3. **Service-Fehler**: Ungültiger Service-Pfad
4. **Formatfehler**: SAP liefert HTML-Fehlerseite

## Logging

Die Integration verwendet NestJS Logger mit folgenden Log-Levels:
- **INFO**: Erfolgreiche Requests und Konfiguration
- **ERROR**: Fehler bei SAP-Kommunikation
- **DEBUG**: Detaillierte Request/Response-Informationen

## Sicherheit

### SSL/TLS
- Standardmäßig werden selbstsignierte Zertifikate akzeptiert
- Für Produktionsumgebungen: `rejectUnauthorized: true` setzen

### Authentifizierung
- Basic Authentication mit SAP-Credentials
- Credentials werden Base64-kodiert übertragen
- Keine lokale Speicherung von Credentials

## Performance

### Timeouts
- Standard-Timeout: 30 Sekunden
- Konfigurierbar über `timeout`-Parameter

### Caching
- Aktuell kein Caching implementiert
- Kann bei Bedarf über Redis/Memory-Cache erweitert werden

## Migration vom Everest-Framework

### Hauptunterschiede
1. **Framework**: Everest → NestJS
2. **Session-Management**: Everest ISession → HTTP-Requests
3. **Caching**: AgentDB → Nicht implementiert (erweiterbar)
4. **Error-Handling**: Everest-spezifisch → NestJS-Exceptions

### Beibehaltene Funktionalität
- Vollständige OData-Unterstützung
- SAP-Authentifizierung
- Metadaten- und Datenabfragen
- Fehlerbehandlung und Validierung

## Beispiel-Integration

```typescript
// In einem anderen Service
import { SapService } from './sap/sap.service';

@Injectable()
export class MyService {
  constructor(private sapService: SapService) {}

  async getSapData() {
    const connectionInfo = {
      baseUrl: 'https://sap-system:44301',
      username: process.env.SAP_USERNAME,
      password: process.env.SAP_PASSWORD,
      rejectUnauthorized: false
    };

    const response = await this.sapService.getData(
      '/sap/opu/odata/sap/ZSERVICE/Products',
      connectionInfo
    );

    return response.parsedContent;
  }
}
```

## Umgebungsvariablen

Empfohlene Umgebungsvariablen für Produktionsumgebungen:

```env
SAP_BASE_URL=https://your-sap-system:44301
SAP_USERNAME=your-sap-user
SAP_PASSWORD=your-sap-password
SAP_TIMEOUT=30000
SAP_REJECT_UNAUTHORIZED=true
```

## Erweiterungsmöglichkeiten

1. **Caching**: Redis/Memory-Cache für häufige Abfragen
2. **Connection Pooling**: Wiederverwendung von HTTP-Verbindungen
3. **Batch-Requests**: Mehrere OData-Requests in einem Call
4. **Monitoring**: Metriken und Health-Checks
5. **Rate Limiting**: Schutz vor zu vielen Requests

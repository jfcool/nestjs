# SAP OData Integration API Dokumentation

## Übersicht

Diese API bietet eine vollständige Integration mit SAP OData Services, einschließlich Entity Sets Explorer, Connection Management und SAP Cloud SDK Integration.

**Base URL**: `http://localhost:3002`  
**API Version**: 1.0.0  
**Swagger Docs**: http://localhost:3002/docs

## 🔗 Authentifizierung

Die API verwendet verschiedene Authentifizierungsmethoden je nach Endpoint:
- **SAP-Verbindungen**: Basic Auth über gespeicherte Connection-Daten
- **Lokale Endpoints**: Keine Authentifizierung erforderlich
- **SAP Cloud SDK**: Automatische Destination-basierte Authentifizierung

## 📊 API Endpoints

### 🏥 Health & Status

#### GET /sapodata/health
Überprüft den Status der API.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-09-12T10:30:00.000Z"
}
```

#### GET /sapodata/cloud-sdk/health
Überprüft den Status des SAP Cloud SDK.

**Response:**
```json
{
  "status": "ok",
  "mode": "local",
  "timestamp": "2025-09-12T10:30:00.000Z"
}
```

### 🔗 Connection Management

#### GET /sapodata/connections
Listet alle gespeicherten SAP-Verbindungen auf.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "SAP Production",
    "type": "SAP",
    "parameters": {
      "baseUrl": "https://sap-system:44301",
      "username": "user"
    },
    "status": "active",
    "createdAt": "2025-09-12T10:00:00.000Z"
  }
]
```

#### POST /sapodata/connections
Erstellt eine neue SAP-Verbindung.

**Request Body:**
```json
{
  "name": "Mein SAP System",
  "type": "SAP",
  "parameters": {
    "baseUrl": "https://your-sap-system:44301",
    "username": "sap_user",
    "password": "sap_password",
    "client": "100",
    "rejectUnauthorized": false
  }
}
```

#### GET /sapodata/connections/:id
Ruft Details einer spezifischen Verbindung ab.

#### PUT /sapodata/connections/:id
Aktualisiert eine bestehende Verbindung.

#### DELETE /sapodata/connections/:id
Löscht eine Verbindung.

#### POST /sapodata/connections/:id/test
Testet eine Verbindung.

### 📋 Service Catalog

#### POST /sapodata/connection/:connectionId/catalog
Lädt den SAP Service Catalog.

**Request Body:**
```json
{
  "cacheConnectionId": "optional-cache-connection-id"
}
```

**Response:**
```json
{
  "content": "...",
  "contentType": "application/json",
  "url": "https://sap-system/sap/opu/odata/IWFND/CATALOGSERVICE...",
  "isJson": true,
  "parsedContent": {
    "d": {
      "results": [
        {
          "ID": "API_BUSINESS_PARTNER",
          "Title": "Business Partner API",
          "TechnicalServiceName": "API_BUSINESS_PARTNER"
        }
      ]
    }
  },
  "dataSource": "sap"
}
```

### 📊 Entity Sets Explorer

#### POST /sapodata/connection/:connectionId/service/:serviceName/metadata/parsed
Lädt und parst Metadaten eines SAP OData Service.

**URL Parameter:**
- `connectionId`: UUID der SAP-Verbindung
- `serviceName`: Name des SAP OData Service (z.B. "API_BUSINESS_PARTNER")

**Request Body:**
```json
{
  "cacheConnectionId": "optional-cache-connection-id"
}
```

**Response:**
```json
{
  "entitySets": [
    {
      "name": "A_BusinessPartner",
      "entityType": "A_BusinessPartnerType",
      "properties": [
        {
          "name": "BusinessPartner",
          "type": "Edm.String",
          "nullable": false
        },
        {
          "name": "BusinessPartnerName",
          "type": "Edm.String",
          "nullable": true
        }
      ],
      "keyProperties": ["BusinessPartner"]
    }
  ],
  "summary": {
    "totalEntitySets": 25,
    "totalEntityTypes": 20,
    "entitySetNames": ["A_BusinessPartner", "A_BusinessPartnerAddress", ...]
  }
}
```

#### POST /sapodata/connection/:connectionId/service/:serviceName/entityset/:entitySetName
Lädt Daten aus einem spezifischen Entity Set.

**URL Parameter:**
- `connectionId`: UUID der SAP-Verbindung
- `serviceName`: Name des SAP OData Service
- `entitySetName`: Name des Entity Sets

**Request Body:**
```json
{
  "options": {
    "top": 50,
    "skip": 0,
    "filter": "BusinessPartnerCategory eq '1'",
    "orderby": "BusinessPartnerName asc",
    "select": "BusinessPartner,BusinessPartnerName",
    "expand": "to_BusinessPartnerAddress"
  },
  "cacheConnectionId": "optional-cache-connection-id"
}
```

**Response:**
```json
{
  "content": "...",
  "contentType": "application/json",
  "url": "https://sap-system/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner?$top=50",
  "isJson": true,
  "parsedContent": {
    "d": {
      "results": [
        {
          "BusinessPartner": "0000000001",
          "BusinessPartnerName": "Mustermann GmbH"
        }
      ]
    }
  },
  "dataSource": "sap",
  "sapInfo": {
    "timestamp": "2025-09-12T10:30:00.000Z",
    "servicePath": "/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner"
  }
}
```

### ☁️ SAP Cloud SDK Integration

#### POST /sapodata/cloud-sdk/execute
Führt einen generischen HTTP-Request über das SAP Cloud SDK aus.

**Request Body:**
```json
{
  "connectionId": "uuid-of-sap-connection",
  "servicePath": "/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner?$top=5",
  "method": "GET",
  "headers": {
    "Accept": "application/json"
  },
  "data": {}
}
```

**Response:**
```json
{
  "data": {
    "d": {
      "results": [...]
    }
  },
  "status": 200,
  "statusText": "OK",
  "headers": {
    "content-type": "application/json"
  },
  "url": "https://sap-system/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner",
  "timestamp": "2025-09-12T10:30:00.000Z",
  "source": "sap-cloud-sdk"
}
```

#### POST /sapodata/cloud-sdk/business-partners
Beispiel-Endpoint für Business Partner Abfrage.

**Request Body:**
```json
{
  "connectionId": "uuid-of-sap-connection",
  "top": 5
}
```

### 📋 Legacy Endpoints (Direct Connection)

#### POST /sapodata/data
Lädt OData Service Daten mit direkter Verbindungsinfo.

**Request Body:**
```json
{
  "servicePath": "/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner",
  "connectionInfo": {
    "baseUrl": "https://sap-system:44301",
    "username": "sap_user",
    "password": "sap_password",
    "rejectUnauthorized": false
  }
}
```

#### POST /sapodata/metadata
Lädt OData Metadaten mit direkter Verbindungsinfo.

#### POST /sapodata/catalog
Lädt Service Catalog mit direkter Verbindungsinfo.

## 🔧 OData Query Parameter

Die API unterstützt alle Standard OData Query Parameter:

| Parameter | Beschreibung | Beispiel |
|-----------|--------------|----------|
| `$top` | Anzahl der Ergebnisse begrenzen | `$top=50` |
| `$skip` | Ergebnisse überspringen (Paginierung) | `$skip=100` |
| `$filter` | Filterausdrücke | `$filter=Name eq 'Test'` |
| `$orderby` | Sortierung | `$orderby=Name asc` |
| `$select` | Feldauswahl | `$select=ID,Name,Description` |
| `$expand` | Verwandte Entitäten erweitern | `$expand=to_Address` |

### Filter-Beispiele

```bash
# Gleichheit
$filter=BusinessPartnerCategory eq '1'

# Vergleiche
$filter=CreationDate gt datetime'2025-01-01T00:00:00'

# String-Funktionen
$filter=startswith(BusinessPartnerName, 'SAP')

# Logische Operatoren
$filter=BusinessPartnerCategory eq '1' and Country eq 'DE'

# In-Operator
$filter=BusinessPartnerCategory in ('1','2')
```

## 🗄️ Caching

Die API unterstützt intelligentes Caching über AgentDB:

### Cache-Verhalten
- **Metadaten**: Werden automatisch gecacht für bessere Performance
- **Service-Daten**: Können optional gecacht werden
- **Cache-Invalidierung**: Über Refresh-Buttons in der UI

### Cache-Indikatoren in Responses
```json
{
  "dataSource": "cache",
  "cacheInfo": {
    "source": "agentdb",
    "timestamp": "2025-09-12T10:30:00.000Z",
    "servicePath": "/sap/opu/odata/sap/API_BUSINESS_PARTNER/$metadata"
  }
}
```

## ❌ Fehlerbehandlung

### HTTP Status Codes
- `200` - Erfolg
- `400` - Ungültige Anfrage
- `401` - Authentifizierung fehlgeschlagen
- `404` - Ressource nicht gefunden
- `500` - Interner Serverfehler

### Fehler-Response Format
```json
{
  "statusCode": 500,
  "message": "Failed to fetch SAP data: SAP HTTP 500: Internal Server Error",
  "error": "Internal Server Error",
  "details": {
    "sapError": {
      "code": "/IWBEP/CM_MGW_RT/021",
      "message": {
        "lang": "en",
        "value": "Method 'GET_ENTITYSET' not implemented in data provider class"
      }
    }
  }
}
```

### Häufige Fehler

#### SAP-Verbindungsfehler
```json
{
  "message": "SAP HTTP 401: Unauthorized",
  "details": "Check username and password"
}
```

#### Entity Set nicht implementiert
```json
{
  "message": "Method 'GET_ENTITYSET' not implemented in data provider class",
  "details": "This entity set does not support data queries"
}
```

#### Timeout-Fehler
```json
{
  "message": "Request timeout after 30000ms",
  "details": "SAP system did not respond within timeout period"
}
```

## 🚀 Beispiel-Workflows

### 1. Service Catalog laden und Entity Sets erkunden

```bash
# 1. Service Catalog laden
curl -X POST http://localhost:3002/sapodata/connection/your-connection-id/catalog \
  -H "Content-Type: application/json" \
  -d '{}'

# 2. Entity Sets für einen Service laden
curl -X POST http://localhost:3002/sapodata/connection/your-connection-id/service/API_BUSINESS_PARTNER/metadata/parsed \
  -H "Content-Type: application/json" \
  -d '{}'

# 3. Daten aus einem Entity Set abfragen
curl -X POST http://localhost:3002/sapodata/connection/your-connection-id/service/API_BUSINESS_PARTNER/entityset/A_BusinessPartner \
  -H "Content-Type: application/json" \
  -d '{
    "options": {
      "top": 10,
      "filter": "BusinessPartnerCategory eq '\''1'\''"
    }
  }'
```

### 2. SAP Cloud SDK verwenden

```bash
# Generischer Request
curl -X POST http://localhost:3002/sapodata/cloud-sdk/execute \
  -H "Content-Type: application/json" \
  -d '{
    "connectionId": "your-connection-id",
    "servicePath": "/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner?$top=5",
    "method": "GET"
  }'

# Business Partners Beispiel
curl -X POST http://localhost:3002/sapodata/cloud-sdk/business-partners \
  -H "Content-Type: application/json" \
  -d '{
    "connectionId": "your-connection-id",
    "top": 10
  }'
```

## 📚 Weiterführende Dokumentation

- [Lokale Entwicklung](./LOCAL_DEVELOPMENT_GUIDE.md)
- [BTP Deployment](./BTP_DEPLOYMENT_GUIDE.md)
- [Entity Sets Implementation](./ENTITYSETS_IMPLEMENTATION.md)
- [SAP OData Dokumentation](https://help.sap.com/docs/SAP_NETWEAVER_AS_ABAP_FOR_SOH/68bf513362174d54b58cddec28794093/59283fc4528f486b83b1a58a4f1063c0.html)
- [SAP Cloud SDK Dokumentation](https://sap.github.io/cloud-sdk/)

## 🔧 Entwickler-Hinweise

### Rate Limiting
- Keine expliziten Rate Limits implementiert
- SAP-System kann eigene Limits haben
- Empfehlung: Nicht mehr als 10 Requests/Sekunde

### Performance-Optimierung
- Verwenden Sie Caching für häufig abgerufene Metadaten
- Nutzen Sie `$select` um nur benötigte Felder abzurufen
- Implementieren Sie Paginierung mit `$top` und `$skip`

### Sicherheit
- Verwenden Sie `rejectUnauthorized: false` nur in Entwicklungsumgebungen
- Speichern Sie Passwörter verschlüsselt in der Datenbank
- Implementieren Sie Logging für Audit-Zwecke

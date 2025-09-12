# SAP OData Integration - Lokale Entwicklung

## ✅ Was bereits implementiert ist:

Das Projekt bietet eine vollständige SAP OData Integration mit mehreren Explorern und Tools:

### 🔗 SAP OData Features:
- **Services Explorer**: Durchsuchen und Laden von SAP OData Services
- **Entity Sets Viewer**: Interaktive Exploration von Entity Sets mit Metadaten ✅ **FUNKTIONIERT**
- **Data Explorer**: Abfrage und Anzeige von SAP-Daten mit OData-Parametern
- **Metadata Viewer**: XML-Metadaten-Anzeige und -Analyse
- **SAP Cloud SDK Integration**: Professionelle SAP-Konnektivität
- **Connection Management**: Verwaltung mehrerer SAP-Systemverbindungen
- **AgentDB Caching**: Intelligente Zwischenspeicherung für bessere Performance

### 🛠️ Backend Features:
- **Vollständige API**: 30+ Endpoints für SAP OData Integration
- **Entity Sets Parser**: Automatisches Parsen von SAP Metadaten
- **Connection Management**: Sichere Speicherung von SAP-Verbindungen
- **SAP Cloud SDK**: Lokale und BTP-Integration
- **AgentDB Caching**: Performance-Optimierung durch intelligente Zwischenspeicherung
- **Fehlerbehandlung**: Umfassende SAP-spezifische Fehlerbehandlung

### 🎨 Frontend Features:
- **Moderne React UI**: Responsive Design mit Custom Components
- **Fünf Explorer-Tabs**: Services, Metadata, Data, Entity Sets, SAP Cloud SDK
- **Interaktive Datenabfrage**: Konfigurierbare OData-Parameter
- **Erweiterte Suche**: Multi-Word-Suche in Entity Sets und Services
- **Cache-Integration**: Anzeige von Datenquellen und Cache-Status

## 🚀 So verwenden Sie es lokal:

### Schritt 1: SAP-Verbindung erstellen
1. Gehen Sie zu **SAP OData > Connections**
2. Erstellen Sie eine neue SAP-Verbindung mit Ihren SAP-System Daten:
   ```
   Name: Mein SAP System
   Type: SAP
   Base URL: https://your-sap-system.com:8000
   Username: Ihr SAP Username
   Password: Ihr SAP Passwort
   Client: 100 (oder Ihr SAP Client)
   ```

### Schritt 2: SAP Cloud SDK Tab verwenden
1. Gehen Sie zu **SAP OData > ☁️ SAP Cloud SDK**
2. Wählen Sie Ihre SAP-Verbindung aus der Dropdown-Liste
3. Der Service Path ist bereits vorausgefüllt: `/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner?$top=5`
4. Klicken Sie auf **"Business Partners abrufen"**

### Schritt 3: Eigene Requests testen
Sie können auch eigene OData-Calls testen:
- **Service Path**: z.B. `/sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrder?$top=10`
- **HTTP Method**: GET, POST, PUT, DELETE
- **Custom Headers**: Falls benötigt

## 🔧 Technische Details:

### Wie es funktioniert:
1. **Keine BTP-Abhängigkeit**: Das System verwendet Ihre lokalen SAP-Verbindungen
2. **SAP Cloud SDK Integration**: Nutzt die SDK-Features für HTTP-Requests und Fehlerbehandlung
3. **Automatische Authentication**: Basic Auth wird automatisch aus Ihren Verbindungsdaten übernommen
4. **Fehlerbehandlung**: Detaillierte Logs und Fehlermeldungen

### Vorteile gegenüber direkten HTTP-Calls:
- **Bessere Fehlerbehandlung**: SDK behandelt SAP-spezifische Fehler
- **Automatische Retry-Logik**: Bei temporären Netzwerkfehlern
- **Optimierte Performance**: Connection Pooling und Caching
- **SAP-Standards**: Folgt SAP-Best-Practices für OData-Calls

## 📝 Beispiel-Requests:

### Business Partners abrufen:
```bash
curl -X POST http://localhost:3002/sapodata/cloud-sdk/business-partners \
  -H "Content-Type: application/json" \
  -d '{"connectionId": "ihre-connection-id"}'
```

### Generischer OData Call:
```bash
curl -X POST http://localhost:3002/sapodata/cloud-sdk/execute \
  -H "Content-Type: application/json" \
  -d '{
    "connectionId": "ihre-connection-id",
    "servicePath": "/sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrder?$top=5",
    "method": "GET"
  }'
```

### Health Check:
```bash
curl http://localhost:3002/sapodata/cloud-sdk/health
```

**✅ Health Check erfolgreich getestet:**
```json
{
  "status": "ok",
  "sdkVersion": "4.1.1",
  "timestamp": "2025-09-12T09:01:21.946Z"
}
```

## 🎯 Nächste Schritte:

1. **SAP-Verbindung erstellen** (falls noch nicht vorhanden)
2. **SAP Cloud SDK Tab testen** mit Ihren echten SAP-Daten
3. **Verschiedene OData Services ausprobieren**
4. **Custom Headers hinzufügen** falls benötigt

## 💡 Tipps:

- **CSRF-Token**: Wird automatisch vom SDK behandelt
- **Session Management**: SDK übernimmt Cookie-Handling
- **Timeout**: Standard 30 Sekunden, konfigurierbar
- **SSL-Zertifikate**: Können über Connection-Einstellungen deaktiviert werden

Das System ist bereit für lokale Entwicklung - keine Cloud Foundry oder BTP-Konfiguration erforderlich!

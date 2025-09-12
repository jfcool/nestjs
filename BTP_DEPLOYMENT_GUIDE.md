# SAP BTP Cloud Foundry Deployment Guide

## Voraussetzungen

1. ✅ Cloud Foundry CLI installiert (`cf-cli@8`)
2. ✅ SAP Cloud SDK im Backend installiert
3. ✅ Manifest.yml und VCAP Services konfiguriert
4. 🔄 SAP BTP Account mit Cloud Foundry Environment

## Schritt 1: BTP Login und Setup

### 1.1 Bei SAP BTP anmelden
```bash
# Login bei SAP BTP (ersetzen Sie die URL mit Ihrer BTP Region)
cf login -a https://api.cf.us10-001.hana.ondemand.com

# Oder für Europa:
cf login -a https://api.cf.eu10-001.hana.ondemand.com
```

Sie werden nach folgenden Daten gefragt:
- **Email**: Ihre BTP Account Email
- **Password**: Ihr BTP Passwort
- **Org**: Ihre BTP Organization
- **Space**: Ihr BTP Space (z.B. "dev", "prod")

### 1.2 Aktuellen Status prüfen
```bash
# Aktuellen Space anzeigen
cf target

# Verfügbare Services anzeigen
cf marketplace
```

## Schritt 2: Service Instances erstellen

### 2.1 Connectivity Service
```bash
cf create-service connectivity lite my-connectivity
```

### 2.2 Destination Service
```bash
cf create-service destination lite my-destination
```

### 2.3 XSUAA Service (für Authentication)
```bash
# xs-security.json erstellen (siehe unten)
cf create-service xsuaa application my-xsuaa -c xs-security.json
```

### 2.4 Service Status prüfen
```bash
cf services
```

## Schritt 3: xs-security.json erstellen

Erstellen Sie eine `xs-security.json` Datei im `apps/api` Verzeichnis:

```json
{
  "xsappname": "nestjs-sap-app",
  "tenant-mode": "dedicated",
  "scopes": [
    {
      "name": "$XSAPPNAME.read",
      "description": "Read access"
    }
  ],
  "role-templates": [
    {
      "name": "Viewer",
      "description": "View data",
      "scope-references": [
        "$XSAPPNAME.read"
      ]
    }
  ]
}
```

## Schritt 4: Destination in BTP konfigurieren

1. Gehen Sie zu Ihrem BTP Cockpit
2. Navigieren Sie zu **Connectivity > Destinations**
3. Erstellen Sie eine neue Destination mit dem Namen `S4HANA_ONPREM`:

```
Name: S4HANA_ONPREM
Type: HTTP
URL: https://your-s4hana-system.com
Proxy Type: OnPremise (falls On-Premise) oder Internet (falls Cloud)
Authentication: BasicAuthentication
User: [Ihr SAP User]
Password: [Ihr SAP Passwort]

Additional Properties:
- sap-client: [Ihr SAP Client, z.B. 100]
- HTML5.DynamicDestination: true
```

## Schritt 5: Application deployen

### 5.1 Build erstellen
```bash
# Im Root-Verzeichnis
cd apps/api
npm run build
```

### 5.2 Deploy mit CF Push
```bash
# Im apps/api Verzeichnis
cf push
```

### 5.3 Deployment Status prüfen
```bash
cf apps
cf logs nestjs-sap-app --recent
```

## Schritt 6: Testen

### 6.1 App URL ermitteln
```bash
cf apps
# Notieren Sie sich die URL Ihrer App
```

### 6.2 Health Check
```bash
curl https://your-app-url.cfapps.us10-001.hana.ondemand.com/sapodata/cloud-sdk/health
```

### 6.3 Business Partners abrufen
```bash
curl -X POST https://your-app-url.cfapps.us10-001.hana.ondemand.com/sapodata/cloud-sdk/business-partners \
  -H "Content-Type: application/json" \
  -d '{"destinationName": "S4HANA_ONPREM"}'
```

## Troubleshooting

### Häufige Probleme:

1. **Service Binding Fehler**
   ```bash
   cf restage nestjs-sap-app
   ```

2. **VCAP_SERVICES nicht verfügbar**
   ```bash
   cf env nestjs-sap-app
   ```

3. **Destination nicht gefunden**
   - Prüfen Sie die Destination im BTP Cockpit
   - Stellen Sie sicher, dass der Name exakt übereinstimmt

4. **Connectivity Proxy Fehler**
   - Nur in BTP Cloud Foundry verfügbar
   - Lokal nicht testbar

### Logs anzeigen
```bash
# Live Logs
cf logs nestjs-sap-app

# Letzte Logs
cf logs nestjs-sap-app --recent
```

## Nützliche CF Commands

```bash
# App neustarten
cf restart nestjs-sap-app

# App stoppen/starten
cf stop nestjs-sap-app
cf start nestjs-sap-app

# Environment Variables anzeigen
cf env nestjs-sap-app

# Service Bindings anzeigen
cf service-keys my-connectivity
cf service-keys my-destination
cf service-keys my-xsuaa

# App löschen (Vorsicht!)
cf delete nestjs-sap-app
```

## Kosten

- **Connectivity Service (lite)**: Kostenlos
- **Destination Service (lite)**: Kostenlos  
- **XSUAA (application)**: Kostenlos bis zu bestimmten Limits
- **Runtime**: Abhängig von Memory/Disk Usage

## Nächste Schritte

Nach erfolgreichem Deployment können Sie:
1. Die Web-App auf die BTP URL umstellen
2. Weitere Destinations konfigurieren
3. Monitoring und Logging einrichten
4. CI/CD Pipeline aufsetzen

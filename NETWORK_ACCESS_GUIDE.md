# Netzwerk-Zugriff auf den Chatbot

## Übersicht

Ihr Chatbot ist jetzt so konfiguriert, dass er von anderen Rechnern im Netzwerk erreichbar ist.

## Konfigurierte Änderungen

### 1. Backend (API) - Port 3001
- **Host-Binding**: `0.0.0.0` (alle Netzwerk-Interfaces)
- **CORS**: Erlaubt alle Origins in der Entwicklung
- **Port**: 3001 (Standard)

### 2. Frontend (Web) - Port 3000
- **Next.js**: Läuft standardmäßig auf `localhost:3000`

## Zugriff von anderen Rechnern

### Schritt 1: IP-Adresse ermitteln

**Windows:**
```cmd
ipconfig
```

**macOS/Linux:**
```bash
ifconfig
# oder
ip addr show
```

Suchen Sie nach Ihrer lokalen IP-Adresse (z.B. `192.168.1.100`)

### Schritt 2: Backend starten

```bash
cd apps/api
npm run start:dev
```

Das Backend ist dann erreichbar unter:
- **Lokal**: `http://localhost:3001`
- **Netzwerk**: `http://[IHRE-IP]:3001`

### Schritt 3: Frontend starten

```bash
cd apps/web
npm run dev -- --host 0.0.0.0
```

Das Frontend ist dann erreichbar unter:
- **Lokal**: `http://localhost:3000`
- **Netzwerk**: `http://[IHRE-IP]:3000`

## Beispiel-Zugriff

Wenn Ihre IP-Adresse `192.168.1.100` ist:

- **Chatbot-Frontend**: `http://192.168.1.100:3000/chat`
- **API-Dokumentation**: `http://192.168.1.100:3001/docs`
- **SAP-Daten**: `http://192.168.1.100:3000/sapodata`

## Firewall-Einstellungen

### Windows
1. Windows-Taste + R → `wf.msc`
2. "Eingehende Regeln" → "Neue Regel"
3. Port → TCP → Bestimmte lokale Ports: `3000,3001`
4. Verbindung zulassen → Alle Profile → Name: "Chatbot Ports"

### macOS
```bash
# Firewall-Status prüfen
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# Falls aktiviert, Ports freigeben (normalerweise nicht nötig)
```

### Linux (Ubuntu/Debian)
```bash
sudo ufw allow 3000
sudo ufw allow 3001
```

## Produktions-Deployment

Für Produktionsumgebungen sollten Sie:

1. **Spezifische CORS-Origins** konfigurieren
2. **HTTPS** verwenden
3. **Reverse Proxy** (nginx/Apache) einrichten
4. **Authentifizierung** implementieren

## Troubleshooting

### Problem: "Connection refused"
- Prüfen Sie, ob die Services laufen
- Prüfen Sie Firewall-Einstellungen
- Verwenden Sie die richtige IP-Adresse

### Problem: "CORS Error"
- In der Entwicklung sollte CORS automatisch erlaubt sein
- Prüfen Sie die Browser-Konsole für Details

### Problem: Frontend lädt nicht
- Starten Sie das Frontend mit `--host 0.0.0.0`
- Prüfen Sie, ob Port 3000 verfügbar ist

## Sicherheitshinweise

⚠️ **Wichtig**: Diese Konfiguration ist für Entwicklungszwecke optimiert. In Produktionsumgebungen sollten Sie:

- Spezifische CORS-Origins definieren
- HTTPS verwenden
- Authentifizierung implementieren
- Firewall-Regeln restriktiver gestalten

## Schnellstart-Befehle

```bash
# Terminal 1: Backend starten
cd apps/api && npm run start:dev

# Terminal 2: Frontend starten (netzwerkweit)
cd apps/web && npm run dev -- --host 0.0.0.0

# Ihre IP-Adresse finden
# Windows: ipconfig
# macOS/Linux: ifconfig
```

Dann können andere Rechner auf `http://[IHRE-IP]:3000/chat` zugreifen.

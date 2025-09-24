# 📄 Unterstützte Dokumentenformate im RAG-System

## ✅ **Vollständig unterstützte Dateiformate:**

### 📝 **Text-Dokumente**
- **`.txt`** - Einfache Textdateien
- **`.md`** - Markdown-Dokumente  
- **`.markdown`** - Markdown-Dokumente (alternative Endung)

### 🌐 **Web-Dokumente**
- **`.html`** - HTML-Dateien (mit automatischer Tag-Entfernung)
- **`.htm`** - HTML-Dateien (alternative Endung)

### 📊 **Strukturierte Daten**
- **`.json`** - JSON-Dateien (formatiert für bessere Lesbarkeit)
- **`.csv`** - CSV-Dateien (mit Header-Erkennung)

### 📄 **Office-Dokumente** ✨ **NEU!**
- **`.pdf`** - PDF-Dokumente (mit Metadaten-Extraktion)
- **`.docx`** - Microsoft Word-Dokumente (moderne Format)

## 🔧 **Technische Details:**

### **PDF-Verarbeitung:**
- **Bibliothek**: `pdf-parse`
- **Features**: 
  - Vollständige Textextraktion
  - Seitenzahl-Erkennung
  - Metadaten-Extraktion (Autor, Titel, etc.)
  - Robuste Fehlerbehandlung

### **Word-Dokument-Verarbeitung:**
- **Bibliothek**: `mammoth`
- **Features**:
  - Textextraktion aus .docx-Dateien
  - Formatierung wird in Text umgewandelt
  - Warnung-System für nicht unterstützte Elemente

### **Automatische Verarbeitung:**
- **Chunking**: Alle Dokumente werden in 1200-Zeichen-Blöcke mit 150-Zeichen-Überlappung aufgeteilt
- **Embedding**: Jeder Chunk wird mit Ollama-Embeddings (768D) vektorisiert
- **Indexierung**: Automatische Speicherung in PostgreSQL mit pgvector
- **Metadaten**: Dateityp, Größe, Änderungsdatum, SHA256-Hash

## 🚀 **Verwendung:**

### **Automatische Erkennung:**
Das System erkennt Dateiformate automatisch anhand der Dateiendung und wählt den entsprechenden Parser.

### **Chat-Integration:**
```
Benutzer: "In welchen meiner PDF-Dokumente kommt 'SAP' vor?"
System: → Automatische Dokumentensuche → Strukturierte Ergebnisse mit Relevanz-Scores
```

### **Unterstützte Suchanfragen:**
- "Welche Word-Dokumente enthalten 'ABAP'?"
- "Finde PDF-Dateien über S/4HANA"
- "Durchsuche meine Dokumente nach 'Fiori'"

## 📈 **Performance:**

### **Verarbeitungszeiten:**
- **PDF**: ~2-5 Sekunden (je nach Größe)
- **DOCX**: ~1-3 Sekunden
- **Text/JSON/CSV**: <1 Sekunde
- **HTML**: ~1 Sekunde

### **Embedding-Generation:**
- **Ollama**: 768D Vektoren in <1 Sekunde pro Chunk
- **Lokale Verarbeitung**: Keine externen API-Aufrufe nötig

## 🔄 **Automatische Überwachung:**

Das System überwacht das `./documents` Verzeichnis und:
- **Erkennt neue Dateien** automatisch
- **Verarbeitet unterstützte Formate** sofort
- **Aktualisiert den Index** in Echtzeit
- **Protokolliert alle Aktivitäten**

## 🛠 **Erweiterte Features:**

### **Intelligente Titel-Extraktion:**
- **PDF**: Aus Metadaten oder Dateiname
- **DOCX**: Aus Dokumenteigenschaften oder Dateiname
- **HTML**: Aus `<title>`-Tag oder Dateiname

### **Metadaten-Anreicherung:**
- **Dateigröße und Änderungsdatum**
- **SHA256-Checksumme** für Duplikatserkennung
- **Seitenzahl** (bei PDFs)
- **Formatierungswarnungen** (bei DOCX)

### **Fehlerbehandlung:**
- **Robuste Parser** mit detailliertem Logging
- **Fallback-Mechanismen** bei Parsing-Fehlern
- **Benutzerfreundliche Fehlermeldungen**

## 🎯 **Nächste Schritte:**

### **Geplante Erweiterungen:**
- **`.pptx`** - PowerPoint-Präsentationen
- **`.xlsx`** - Excel-Tabellen
- **`.rtf`** - Rich Text Format
- **`.odt`** - OpenDocument Text

### **Verbesserungen:**
- **OCR-Support** für gescannte PDFs
- **Tabellen-Extraktion** aus PDFs
- **Bild-Text-Erkennung**
- **Mehrsprachige Dokumentenerkennung**

---

Das RAG-System unterstützt jetzt eine breite Palette von Dokumentenformaten und bietet eine nahtlose, intelligente Dokumentensuche direkt im Chat-Interface! 🎉

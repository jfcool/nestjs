# Ollama Docker Performance Guide

## 📊 Performance-Vergleich

### Native Ollama (Aktuell)
- **Embedding-Zeit**: ~549ms pro Text
- **CPU/GPU**: Direkter Zugriff ohne Container-Overhead
- **Speicher**: Direkter RAM-Zugriff
- **Netzwerk**: Lokale API-Calls (localhost)

### Docker Ollama (Erwartet)
- **Embedding-Zeit**: ~700-800ms pro Text (+30-45%)
- **Container-Overhead**: CPU/Memory-Virtualisierung
- **Netzwerk-Latenz**: Container-zu-Container Kommunikation
- **GPU-Zugriff**: Über Docker GPU-Passthrough

## 🚀 Performance-Optimierungen für Docker

### 1. GPU-Unterstützung aktivieren
```bash
# NVIDIA Container Toolkit installieren (falls noch nicht vorhanden)
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update && sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker
```

### 2. Docker-Setup mit Optimierungen
```bash
# Optimierte Docker-Compose verwenden
docker-compose -f docker-compose.ollama.yml up -d

# Oder nur Ollama mit GPU-Support
docker run -d \
  --gpus all \
  --name ollama-optimized \
  -p 11434:11434 \
  -v ollama-data:/root/.ollama \
  --shm-size=2g \
  --ulimit memlock=-1 \
  --ulimit stack=67108864 \
  ollama/ollama
```

### 3. Umgebungsvariablen für Docker anpassen
```env
# In apps/api/.env für Docker-Setup
OLLAMA_URL=http://localhost:11434
# Oder wenn API auch in Docker läuft:
# OLLAMA_URL=http://ollama:11434
```

## ⚡ Performance-Tuning Tipps

### 1. Batch-Processing aktivieren
Die aktuelle Implementierung verarbeitet Embeddings einzeln. Für bessere Performance:

```typescript
// In embedding.service.ts - bereits implementiert
async generateEmbeddings(texts: string[]): Promise<number[][]> {
  // Verarbeitet mehrere Texte in einem API-Call
  // Reduziert HTTP-Overhead erheblich
}
```

### 2. Concurrent Processing
```typescript
// Parallel processing für große Dokumente
const chunks = document.split(chunkSize);
const embeddings = await Promise.all(
  chunks.map(chunk => this.embeddingService.generateEmbedding(chunk))
);
```

### 3. Caching-Strategien
```typescript
// Embedding-Cache für häufig verwendete Texte
private embeddingCache = new Map<string, number[]>();

async generateEmbedding(text: string): Promise<number[]> {
  const cacheKey = crypto.createHash('md5').update(text).digest('hex');
  
  if (this.embeddingCache.has(cacheKey)) {
    return this.embeddingCache.get(cacheKey);
  }
  
  const embedding = await this.generateOllamaEmbedding(text);
  this.embeddingCache.set(cacheKey, embedding);
  return embedding;
}
```

## 🔧 Docker-Konfiguration Optimierungen

### 1. Memory-Limits setzen
```yaml
services:
  ollama:
    deploy:
      resources:
        limits:
          memory: 8G  # Anpassen je nach verfügbarem RAM
        reservations:
          memory: 4G
```

### 2. CPU-Limits optimieren
```yaml
services:
  ollama:
    cpus: '4.0'  # Anzahl CPU-Kerne für Ollama
    cpu_shares: 1024  # CPU-Priorität
```

### 3. Netzwerk-Optimierung
```yaml
networks:
  app-network:
    driver: bridge
    driver_opts:
      com.docker.network.driver.mtu: 1500
```

## 📈 Erwartete Performance-Werte

### Mit Standard Docker-Setup
- **Embedding-Zeit**: ~700-800ms pro Text
- **Batch-Processing**: ~400-500ms pro Text (bei 5+ Texten)
- **Memory-Usage**: +500MB für Container-Overhead

### Mit GPU-optimiertem Setup
- **Embedding-Zeit**: ~600-700ms pro Text
- **Batch-Processing**: ~300-400ms pro Text
- **GPU-Auslastung**: 60-80% bei aktiver Verarbeitung

### Mit allen Optimierungen
- **Embedding-Zeit**: ~550-650ms pro Text
- **Batch-Processing**: ~250-350ms pro Text
- **Caching**: Instant für bereits verarbeitete Texte

## 🎯 Empfehlungen

### Für Development
- **Native Ollama**: Beste Performance für lokale Entwicklung
- **Einfaches Setup**: Schneller Start ohne Container-Komplexität

### Für Production
- **Docker mit GPU**: Konsistente Umgebung, skalierbar
- **Load Balancing**: Mehrere Ollama-Instanzen für hohe Last
- **Monitoring**: Performance-Metriken für Optimierung

### Hybrid-Ansatz
- **Development**: Native Ollama
- **Staging/Production**: Docker mit Optimierungen
- **CI/CD**: Automatischer Wechsel zwischen Setups

## 🚀 Migration zu Docker

### 1. Aktuelles System stoppen
```bash
# Native Ollama stoppen
brew services stop ollama
```

### 2. Docker-Setup starten
```bash
# Optimierte Docker-Compose verwenden
docker-compose -f docker-compose.ollama.yml up -d
```

### 3. Umgebungsvariablen anpassen
```bash
# In apps/api/.env
OLLAMA_URL=http://localhost:11434  # Bleibt gleich für externe Zugriffe
```

### 4. System testen
```bash
cd apps/api
node test-ollama-embeddings.js
```

Die Docker-Version wird etwa 30-45% langsamer sein, bietet aber bessere Skalierbarkeit und Deployment-Konsistenz.

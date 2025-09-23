import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmbeddingProvider {
  generateEmbeddings(texts: string[]): Promise<number[][]>;
  generateEmbedding(text: string): Promise<number[]>;
  getDimensions(): number;
}

@Injectable()
export class EmbeddingService implements EmbeddingProvider {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly provider: string;
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly model: string;
  private readonly dimensions: number;
  private readonly anthropicApiKey: string;
  private readonly anthropicModel: string;

  constructor(private readonly configService: ConfigService) {
    this.provider = this.configService.get('EMBEDDING_PROVIDER', 'openai');
    this.apiKey = this.configService.get('OPENAI_API_KEY', '');
    this.apiUrl = this.configService.get('EMBEDDING_API_URL', 'https://api.openai.com/v1/embeddings');
    this.model = this.configService.get('EMBEDDING_MODEL', 'text-embedding-3-small');
    this.dimensions = parseInt(this.configService.get('EMBEDDING_DIMENSIONS', '1536'), 10);
    this.anthropicApiKey = this.configService.get('ANTHROPIC_API_KEY', '');
    this.anthropicModel = this.configService.get('ANTHROPIC_EMBEDDING_MODEL', 'claude-3-haiku-20240307');
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const embeddings = await this.generateEmbeddings([text]);
    return embeddings[0];
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      switch (this.provider.toLowerCase()) {
        case 'anthropic':
          return await this.generateAnthropicEmbeddings(texts);
        case 'openai':
          return await this.generateOpenAIEmbeddings(texts);
        case 'ollama':
          return await this.generateOllamaEmbeddings(texts);
        default:
          throw new Error(`Unsupported embedding provider: ${this.provider}`);
      }
    } catch (error) {
      this.logger.error(`Failed to generate embeddings: ${error.message}`);
      throw error;
    }
  }

  getDimensions(): number {
    return this.dimensions;
  }

  private async generateOpenAIEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: texts,
        model: this.model,
        dimensions: this.dimensions,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.data.map((item: any) => item.embedding);
  }

  private async generateAnthropicEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.anthropicApiKey) {
      throw new Error('Anthropic API key not configured');
    }

    this.logger.warn('Anthropic does not provide native embeddings. Using text-based semantic hashing as fallback.');
    
    // Since Anthropic doesn't provide embeddings, we'll use a simple approach:
    // 1. Use Claude to generate semantic summaries
    // 2. Convert these to numerical embeddings using a hash-based approach
    const embeddings: number[][] = [];

    for (const text of texts) {
      try {
        // Get semantic representation from Claude
        const semanticSummary = await this.getSemanticSummary(text);
        
        // Convert to embedding vector
        const embedding = this.textToEmbedding(semanticSummary, this.dimensions);
        embeddings.push(embedding);
      } catch (error) {
        this.logger.error(`Failed to generate Anthropic embedding for text: ${error.message}`);
        // Fallback to simple text-based embedding
        const fallbackEmbedding = this.textToEmbedding(text, this.dimensions);
        embeddings.push(fallbackEmbedding);
      }
    }

    return embeddings;
  }

  private async getSemanticSummary(text: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.anthropicApiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.anthropicModel,
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: `Extract the key semantic concepts and themes from this text in a concise summary (max 50 words): "${text.substring(0, 1000)}"`
        }]
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.content[0].text || text;
  }

  private textToEmbedding(text: string, dimensions: number): number[] {
    // Simple hash-based embedding generation
    // This is a fallback approach - for production, consider using a proper embedding model
    const embedding = new Array(dimensions).fill(0);
    
    // Use multiple hash functions to distribute values
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      const pos1 = (char * 7 + i * 11) % dimensions;
      const pos2 = (char * 13 + i * 17) % dimensions;
      const pos3 = (char * 19 + i * 23) % dimensions;
      
      embedding[pos1] += Math.sin(char * 0.1) * 0.1;
      embedding[pos2] += Math.cos(char * 0.1) * 0.1;
      embedding[pos3] += Math.tan(char * 0.01) * 0.05;
    }
    
    // Normalize the embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < dimensions; i++) {
        embedding[i] /= magnitude;
      }
    }
    
    return embedding;
  }

  private async generateOllamaEmbeddings(texts: string[]): Promise<number[][]> {
    const ollamaUrl = this.configService.get('OLLAMA_URL', 'http://localhost:11434');
    const ollamaModel = this.configService.get('OLLAMA_EMBEDDING_MODEL', 'nomic-embed-text');

    const embeddings: number[][] = [];

    for (const text of texts) {
      const response = await fetch(`${ollamaUrl}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: ollamaModel,
          prompt: text,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      embeddings.push(data.embedding);
    }

    return embeddings;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.generateEmbedding('test');
      return true;
    } catch (error) {
      this.logger.error(`Embedding service connection test failed: ${error.message}`);
      return false;
    }
  }
}

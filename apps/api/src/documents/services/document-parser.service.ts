import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';

export interface ParsedDocument {
  text: string;
  title?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class DocumentParserService {
  private readonly logger = new Logger(DocumentParserService.name);

  async parseDocument(filePath: string): Promise<ParsedDocument> {
    try {
      const ext = path.extname(filePath).toLowerCase();
      const buffer = await fs.readFile(filePath);

      switch (ext) {
        case '.txt':
        case '.md':
        case '.markdown':
          return this.parseTextFile(buffer, filePath);
        case '.json':
          return this.parseJsonFile(buffer, filePath);
        case '.csv':
          return this.parseCsvFile(buffer, filePath);
        case '.html':
        case '.htm':
          return this.parseHtmlFile(buffer, filePath);
        case '.pdf':
          return this.parsePdfFile(buffer, filePath);
        case '.docx':
          return this.parseDocxFile(buffer, filePath);
        default:
          // For unsupported file types, try to read as text
          return this.parseTextFile(buffer, filePath);
      }
    } catch (error) {
      this.logger.error(`Failed to parse document ${filePath}: ${error.message}`);
      throw error;
    }
  }

  private parseTextFile(buffer: Buffer, filePath: string): ParsedDocument {
    const text = buffer.toString('utf8');
    const title = path.basename(filePath, path.extname(filePath));
    
    return {
      text: text.trim(),
      title,
      metadata: {
        fileType: 'text',
        encoding: 'utf8',
      },
    };
  }

  private parseJsonFile(buffer: Buffer, filePath: string): ParsedDocument {
    try {
      const jsonData = JSON.parse(buffer.toString('utf8'));
      const text = JSON.stringify(jsonData, null, 2);
      const title = path.basename(filePath, path.extname(filePath));
      
      return {
        text,
        title,
        metadata: {
          fileType: 'json',
          keys: Object.keys(jsonData),
        },
      };
    } catch (error) {
      throw new Error(`Invalid JSON file: ${error.message}`);
    }
  }

  private parseCsvFile(buffer: Buffer, filePath: string): ParsedDocument {
    const text = buffer.toString('utf8');
    const lines = text.split('\n');
    const title = path.basename(filePath, path.extname(filePath));
    
    // Convert CSV to readable text format
    const formattedText = lines
      .filter(line => line.trim())
      .map((line, index) => {
        if (index === 0) {
          return `Headers: ${line}`;
        }
        return `Row ${index}: ${line}`;
      })
      .join('\n');

    return {
      text: formattedText,
      title,
      metadata: {
        fileType: 'csv',
        rowCount: lines.length - 1,
      },
    };
  }

  private parseHtmlFile(buffer: Buffer, filePath: string): ParsedDocument {
    const html = buffer.toString('utf8');
    
    // Simple HTML text extraction (remove tags)
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Try to extract title from HTML
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : path.basename(filePath, path.extname(filePath));

    return {
      text,
      title,
      metadata: {
        fileType: 'html',
        hasTitle: !!titleMatch,
      },
    };
  }

  private async parsePdfFile(buffer: Buffer, filePath: string): Promise<ParsedDocument> {
    try {
      // Check if buffer has data
      if (!buffer || buffer.length === 0) {
        throw new Error('PDF file is empty or corrupted');
      }
      
      const data = await pdfParse(buffer);
      const title = path.basename(filePath, path.extname(filePath));
      
      return {
        text: data.text.trim(),
        title,
        metadata: {
          fileType: 'pdf',
          pages: data.numpages,
          info: data.info,
        },
      };
    } catch (error) {
      // Log as warning instead of error for corrupted files
      if (error.message.includes('stream must have data') || error.message.includes('empty or corrupted')) {
        this.logger.warn(`Skipping corrupted/empty PDF file: ${path.basename(filePath)}`);
      } else {
        this.logger.error(`Failed to parse PDF file ${filePath}: ${error.message}`);
      }
      throw new Error(`PDF parsing failed: ${error.message}`);
    }
  }

  private async parseDocxFile(buffer: Buffer, filePath: string): Promise<ParsedDocument> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const title = path.basename(filePath, path.extname(filePath));
      
      return {
        text: result.value.trim(),
        title,
        metadata: {
          fileType: 'docx',
          messages: result.messages,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to parse DOCX file ${filePath}: ${error.message}`);
      throw new Error(`DOCX parsing failed: ${error.message}`);
    }
  }

  async getFileInfo(filePath: string): Promise<{
    size: number;
    mtime: Date;
    sha256: string;
    fileType: string;
  }> {
    const stats = await fs.stat(filePath);
    const buffer = await fs.readFile(filePath);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const fileType = path.extname(filePath).toLowerCase().substring(1) || 'unknown';

    return {
      size: stats.size,
      mtime: stats.mtime,
      sha256,
      fileType,
    };
  }

  isSupported(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    const supportedExtensions = [
      '.txt', '.md', '.markdown', '.json', '.csv', '.html', '.htm', '.pdf', '.docx'
    ];
    
    return supportedExtensions.includes(ext);
  }

  async chunkText(text: string, chunkSize: number = 1200, overlap: number = 150): Promise<string[]> {
    if (text.length <= chunkSize) {
      return [text];
    }

    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      let end = start + chunkSize;
      
      // If we're not at the end, try to break at a sentence or word boundary
      if (end < text.length) {
        // Look for sentence boundary
        const sentenceEnd = text.lastIndexOf('.', end);
        const questionEnd = text.lastIndexOf('?', end);
        const exclamationEnd = text.lastIndexOf('!', end);
        
        const sentenceBoundary = Math.max(sentenceEnd, questionEnd, exclamationEnd);
        
        if (sentenceBoundary > start + chunkSize * 0.5) {
          end = sentenceBoundary + 1;
        } else {
          // Look for word boundary
          const wordBoundary = text.lastIndexOf(' ', end);
          if (wordBoundary > start + chunkSize * 0.5) {
            end = wordBoundary;
          }
        }
      }

      const chunk = text.substring(start, end).trim();
      if (chunk) {
        chunks.push(chunk);
      }

      // Move start position with overlap
      start = end - overlap;
      if (start < 0) start = 0;
    }

    return chunks;
  }

  countTokens(text: string): number {
    // Simple token counting (approximate)
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ChunkEntity } from './chunk.entity';

@Entity('documents')
export class DocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  path: string;

  @Column({ type: 'timestamptz' })
  mtime: Date;

  @Column()
  sha256: string;

  @Column({ type: 'jsonb', default: {} })
  meta: Record<string, any>;

  @Column({ nullable: true })
  title: string;

  @Column({ nullable: true })
  fileType: string;

  @Column({ type: 'bigint', default: 0 })
  fileSize: number;

  // Enhanced metadata for better search and classification
  @Column({ nullable: true })
  documentType: string; // 'invoice', 'certificate', 'contract', 'report', etc.

  @Column({ nullable: true })
  category: string; // 'financial', 'legal', 'technical', 'personal', etc.

  @Column({ nullable: true })
  language: string; // 'de', 'en', etc.

  @Column({ type: 'text', nullable: true })
  summary: string; // AI-generated summary for better search

  @Column({ type: 'simple-array', nullable: true })
  keywords: string[]; // Extracted keywords for search

  @Column({ type: 'jsonb', default: {} })
  extractedData: Record<string, any>; // Structured data (dates, amounts, etc.)

  @Column({ type: 'float', default: 1.0 })
  importance: number; // Importance score (0.0 - 2.0, default 1.0)

  @Column({ type: 'int', default: 0 })
  accessCount: number; // How often this document was accessed

  @Column({ type: 'timestamptz', nullable: true })
  lastAccessedAt: Date; // When was it last accessed

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ChunkEntity, (chunk) => chunk.document, { cascade: true })
  chunks: ChunkEntity[];
}

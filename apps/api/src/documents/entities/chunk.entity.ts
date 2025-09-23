import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { DocumentEntity } from './document.entity';

@Entity('chunks')
export class ChunkEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  document_id: string;

  @ManyToOne(() => DocumentEntity, (document) => document.chunks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: DocumentEntity;

  @Column()
  chunk_index: number;

  @Column({ type: 'text' })
  content: string;

  @Column()
  token_count: number;

  // pgvector column - using 1024 dimensions for Anthropic hybrid embeddings
  // Remove index to avoid PostgreSQL size limit issues
  @Column({ type: 'simple-array', nullable: true })
  embedding: number[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

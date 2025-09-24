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

  // pgvector column - COMPLETELY EXCLUDED from TypeORM to prevent interference
  // The DB has native vector(1536) column, we use raw SQL for all operations
  @Index('idx_chunks_embedding_cosine', { synchronize: false }) // pgvector cosine similarity index
  embedding: number[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

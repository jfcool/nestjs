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

  // pgvector column - use text type to prevent TypeORM interference
  @Column({
    type: 'text',
    nullable: true,
    select: false // Don't select by default to avoid performance issues
  })
  embedding?: string | null; // Will be handled as vector in raw SQL

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

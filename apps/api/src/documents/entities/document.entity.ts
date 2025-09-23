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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ChunkEntity, (chunk) => chunk.document, { cascade: true })
  chunks: ChunkEntity[];
}

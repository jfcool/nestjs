import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum ConnectionType {
  SAP = 'sap',
  AGENTDB = 'agentdb',
}

@Entity('connections')
@Index(['name'], { unique: true })
export class Connection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  name: string;

  @Column({
    type: 'enum',
    enum: ConnectionType,
  })
  type: ConnectionType;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description?: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // Generic connection parameters stored as JSON
  @Column({ type: 'jsonb' })
  parameters: Record<string, any>;

  // Optional cache connection reference (only for SAP connections)
  @Column({ type: 'uuid', nullable: true })
  cacheConnectionId?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  createdBy?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  updatedBy?: string;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { EmbeddingSourceType } from '../../auth/entities/embeddingDocument.entity';

export enum EmbeddingJobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Index('IDX_embedding_job_status_scheduled_at', ['status', 'scheduledAt'])
@Unique('UQ_embedding_job_source', ['sourceType', 'sourceId'])
@Entity('EmbeddingJob')
export class EmbeddingJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column({ type: 'enum', enum: EmbeddingSourceType })
  sourceType!: EmbeddingSourceType;

  @Column('uuid')
  sourceId!: string;

  @Column({ type: 'enum', enum: EmbeddingJobStatus })
  status!: EmbeddingJobStatus;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ type: 'text', nullable: true })
  lastError!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  scheduledAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  processingStartedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

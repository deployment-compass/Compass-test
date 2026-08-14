import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum IncidentStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  DRAFT_PR_OPENED = 'DRAFT_PR_OPENED',
  RESOLVED = 'RESOLVED',
  FAILED = 'FAILED',
}

@Entity('incidents')
export class Incident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  alertName: string;

  @Column('jsonb', { nullable: true })
  rawMetrics: object;

  @Column({ type: 'enum', enum: IncidentStatus, default: IncidentStatus.PENDING })
  status: IncidentStatus;

  @Column({ nullable: true })
  draftPrUrl: string;

  @CreateDateColumn()
  createdAt: Date;
}

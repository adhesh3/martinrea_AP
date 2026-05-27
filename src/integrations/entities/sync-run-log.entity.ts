// Manav owns this table — no Roshni dependency.
// Migrations / DDL ship from this repo.

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Which sub-job a sync_run_logs row tracks. */
export enum SyncJobType {
  SUPPLIERS = 'SUPPLIERS',
  PURCHASE_ORDERS = 'PURCHASE_ORDERS',
  GOODS_RECEIPTS = 'GOODS_RECEIPTS',
}

/** Lifecycle of a sync run. */
export enum SyncStatus {
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  PARTIAL = 'PARTIAL',
  FAILED = 'FAILED',
}

/**
 * Persisted log of a single sync sub-job run.
 *
 * `EpicorSyncService.runSyncForInstance(...)` writes one row per sub-job
 * (suppliers + POs), so every orchestrated instance run produces two rows.
 * The orchestrator-level outcome (`SUCCESS` / `PARTIAL` / `FAILED`) is
 * computed in memory and returned via `SyncInstanceResult`.
 */
@Entity('sync_run_logs')
@Index(['instanceId', 'jobType', 'startedAt'])
export class SyncRunLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'int' })
  instanceId!: number;

  @Column({ type: 'enum', enum: SyncJobType })
  jobType!: SyncJobType;

  @Column({ type: 'enum', enum: SyncStatus, default: SyncStatus.RUNNING })
  status!: SyncStatus;

  @Column({ type: 'timestamptz' })
  startedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ type: 'int', default: 0 })
  recordsFetched!: number;

  @Column({ type: 'int', default: 0 })
  recordsInserted!: number;

  @Column({ type: 'int', default: 0 })
  recordsUpdated!: number;

  @Column({ type: 'int', default: 0 })
  recordsFailed!: number;

  @Column({ type: 'varchar', length: 2000, nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'varchar', length: 32, default: 'CRON' })
  triggeredBy!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

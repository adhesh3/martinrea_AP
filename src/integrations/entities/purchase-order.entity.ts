// Canonical schema per Roshni (Data track). Aligned with `dto/purchase-order.dto.ts`.
//
// Key invariants:
//   - `(po_number, instance_id)` is unique. PO numbers are only unique within
//     a single plant instance.
//   - `supplier_id` is the canonical FK to `suppliers(id)`. It is nullable and
//     uses `ON DELETE SET NULL` so a purged supplier row never cascades into
//     PO loss — the denormalised `supplier_code` is retained as an audit
//     breadcrumb on orphaned POs.
//   - Soft-delete only via `deleted_at`.

import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { SupplierEntity } from './supplier.entity';

@Entity('purchase_orders')
@Unique(['poNumber', 'instanceId'])
export class PurchaseOrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  poNumber!: string;

  /** FK to `suppliers(id)`. Null after the parent supplier row is hard-deleted. */
  @Column({ type: 'uuid', nullable: true })
  supplierId!: string | null;

  @ManyToOne(() => SupplierEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'supplier_id' })
  supplier?: SupplierEntity | null;

  /** Denormalised supplier code — survives even when `supplier_id` is nulled. */
  @Column({ type: 'varchar', length: 64 })
  supplierCode!: string;

  @Column({ type: 'int' })
  instanceId!: number;

  @Column({ type: 'varchar', length: 16, default: 'OPEN' })
  status!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  totalAmount!: string;

  /** ISO 4217 currency code from the source PO header. */
  @Column({ type: 'varchar', length: 3, nullable: true })
  currency!: string | null;

  /** Plant / site code that owns the PO. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  plantId!: string | null;

  @Column({ type: 'date', nullable: true })
  needByDate!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastSyncedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}

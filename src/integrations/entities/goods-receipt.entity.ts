// Canonical schema per Roshni (Data track). Aligned with `dto/goods-receipt.dto.ts`.
//
// Key invariants:
//   - `(gr_number, instance_id)` is unique.
//   - `po_id` is the canonical FK to `purchase_orders(id)`. Nullable +
//     `ON DELETE SET NULL` so a PO purge never cascades into GR loss; the
//     denormalised `po_number` is retained as an audit breadcrumb.
//   - No soft-delete column. Receipts are immutable once written — if one is
//     wrong it gets reversed by a new compensating receipt, not patched.

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { PurchaseOrderEntity } from './purchase-order.entity';

/**
 * Source format the goods-receipt was originally pulled from. US plants
 * stream structured rows over ODBC; Mexico plants drop CSV / XML over SFTP.
 * Persisted so downstream consumers can trace which adapter produced the row.
 */
export type GoodsReceiptSource = 'US' | 'MEXICO';

@Entity('goods_receipts')
@Index(['instanceId', 'grNumber'], { unique: true })
export class GoodsReceiptEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  grNumber!: string;

  /** FK to `purchase_orders(id)`. Null after the parent PO row is hard-deleted. */
  @Column({ type: 'uuid', nullable: true })
  poId!: string | null;

  @ManyToOne(() => PurchaseOrderEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'po_id' })
  purchaseOrder?: PurchaseOrderEntity | null;

  /** Denormalised PO number — survives even when `po_id` is nulled. */
  @Column({ type: 'varchar', length: 64 })
  poNumber!: string;

  @Column({ type: 'int' })
  instanceId!: number;

  /** Which regional adapter produced this row. */
  @Column({ type: 'varchar', length: 8 })
  rawSource!: GoodsReceiptSource;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

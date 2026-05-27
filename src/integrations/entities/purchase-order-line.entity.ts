// Canonical schema per Roshni (Data track). Child table of `purchase_orders`.
//
// Key invariants:
//   - `po_id` is a hard FK with `ON DELETE CASCADE` — lines never outlive
//     their parent PO. If the parent row is hard-deleted the lines go with
//     it; if the parent is soft-deleted (`deleted_at`) the lines remain
//     intact and join naturally.
//   - No `deleted_at`. Lines are mutated in place when the upstream Epicor
//     PO is revised; closed lines flip `open_line` to FALSE rather than
//     being deleted.
//   - `ordered_qty` uses NUMERIC(12,4) because Mexico instances regularly
//     ship fractional kg / litre quantities. Money columns use NUMERIC(14,2).

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { PurchaseOrderEntity } from './purchase-order.entity';

@Entity('purchase_order_lines')
@Index(['poId', 'lineNumber'], { unique: true })
export class PurchaseOrderLineEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  poId!: string;

  @ManyToOne(() => PurchaseOrderEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'po_id' })
  purchaseOrder!: PurchaseOrderEntity;

  @Column({ type: 'int' })
  lineNumber!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  partNumber!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 4 })
  orderedQty!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  unitPrice!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  lineTotal!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  unitOfMeasure!: string | null;

  @Column({ type: 'boolean', default: true })
  openLine!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

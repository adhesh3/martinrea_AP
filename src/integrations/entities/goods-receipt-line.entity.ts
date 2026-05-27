// Canonical schema per Roshni (Data track). Child table of `goods_receipts`.
//
// Key invariants:
//   - `gr_id` is a hard FK with `ON DELETE CASCADE` — lines never outlive
//     their parent receipt header.
//   - No `deleted_at`. Receipt lines are immutable once written; a wrong
//     receipt is corrected by a new compensating receipt, not patched.
//   - `po_line_number` is informational (links a GR line back to a PO line
//     for three-way matching); not enforced as an FK because GR lines can
//     arrive before the matching PO line is synced from Epicor.
//   - Quantities use NUMERIC(12,4) (fractional units from MX plants); money
//     columns use NUMERIC(14,2).

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

import { GoodsReceiptEntity } from './goods-receipt.entity';

@Entity('goods_receipt_lines')
@Index(['grId', 'lineNumber'], { unique: true })
export class GoodsReceiptLineEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  grId!: string;

  @ManyToOne(() => GoodsReceiptEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'gr_id' })
  goodsReceipt!: GoodsReceiptEntity;

  @Column({ type: 'int' })
  lineNumber!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  partNumber!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /** Line number on the originating PO. Informational — not an FK. */
  @Column({ type: 'int', nullable: true })
  poLineNumber!: number | null;

  @Column({ type: 'numeric', precision: 12, scale: 4 })
  orderedQty!: string;

  @Column({ type: 'numeric', precision: 12, scale: 4 })
  receivedQty!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  unitPrice!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  lineTotal!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lotNumber!: string | null;

  @Column({ type: 'boolean', default: false })
  receivedComplete!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

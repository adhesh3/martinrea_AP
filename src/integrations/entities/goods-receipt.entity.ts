// Canonical schema per the unified Martinrea AP data model (Roshni / DAT-01).
// Mirrors the shared `goods_receipts` table.
//
// Key invariants:
//   - `gr_number` is globally unique (no per-instance dimension).
//   - PO + supplier are linked by denormalised string codes (`po_number`,
//     `supplier_code` required; `vendor_code` optional), not UUID FKs.
//   - Receipt lines are stored inline as a JSONB array (`line_items`) rather
//     than in a child table.
//   - Soft-delete via `deleted_at` (paranoid).

import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/** Canonical goods-receipt lifecycle status (stored as text). */
export type GoodsReceiptStatus =
  | 'OPEN'
  | 'PARTIALLY_MATCHED'
  | 'FULLY_MATCHED'
  | 'CLOSED';

/** Shape of a single element in the `line_items` JSONB array. */
export interface GoodsReceiptLineItem {
  poLineRef: string;
  partNumber?: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitPrice: number;
  currency: string;
}

@Entity('goods_receipts')
@Unique(['grNumber'])
export class GoodsReceiptEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 60 })
  grNumber!: string;

  /** PO number this receipt was booked against. */
  @Column({ type: 'varchar', length: 60 })
  poNumber!: string;

  /** Canonical supplier code (Epicor VendorNum / CodigoProveedor). */
  @Column({ type: 'varchar', length: 50 })
  supplierCode!: string;

  /** Optional link to the internal vendor master. */
  @Column({ type: 'varchar', length: 50, nullable: true })
  vendorCode!: string | null;

  /** Denormalised supplier name for display in lists / matching UIs. */
  @Column({ type: 'varchar', length: 255 })
  supplierName!: string;

  /** Plant / site code that produced the receipt. */
  @Column({ type: 'varchar', length: 50, nullable: true })
  plantId!: string | null;

  @Column({ type: 'date' })
  receivedDate!: Date;

  @Column({ type: 'varchar', length: 24, default: 'OPEN' })
  status!: GoodsReceiptStatus;

  /** Received line items: see {@link GoodsReceiptLineItem}. */
  @Column({ type: 'jsonb', nullable: true })
  lineItems!: GoodsReceiptLineItem[] | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  totalReceivedValue!: string | null;

  /** ISO 4217 currency code. */
  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}

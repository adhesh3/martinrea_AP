// Canonical schema per the unified Martinrea AP data model (Roshni / DAT-01).
// Mirrors the shared `purchase_orders` table.
//
// Key invariants:
//   - `po_number` is globally unique (no per-instance dimension).
//   - Suppliers/vendors are linked by denormalised string codes
//     (`supplier_code` required, `vendor_code` optional), not UUID FKs.
//   - `supplier_name` is denormalised onto the header for list/matching UIs.
//   - Soft-delete only via `deleted_at` (paranoid).

import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/** Canonical PO lifecycle status (stored as text). */
export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'PARTIALLY_RECEIVED'
  | 'FULLY_RECEIVED'
  | 'CLOSED'
  | 'CANCELLED';

@Entity('purchase_orders')
@Unique(['poNumber'])
export class PurchaseOrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

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

  /** Plant / site code that owns the PO. */
  @Column({ type: 'varchar', length: 50, nullable: true })
  plantId!: string | null;

  /** ISO 4217 currency code from the source PO header. */
  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  totalAmount!: string;

  @Column({ type: 'varchar', length: 24, default: 'OPEN' })
  status!: PurchaseOrderStatus;

  @Column({ type: 'date', nullable: true })
  issuedDate!: Date | null;

  @Column({ type: 'date', nullable: true })
  expectedDeliveryDate!: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}

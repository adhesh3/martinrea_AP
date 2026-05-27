// Canonical schema per Roshni (Data track). Aligned with `dto/supplier.dto.ts`.
//
// Key invariants:
//   - `(supplier_code, instance_id)` is unique. Epicor codes are only unique
//     within a single plant instance — the same `VendorNum` can legitimately
//     refer to different suppliers in two different plants.
//   - `tax_id` is nullable. RFC (MX) / EIN (US) / BN (CA) — sometimes absent
//     in legacy Epicor rows; we store what the ERP gives us.
//   - Soft-delete only via `deleted_at`. Hard deletes never run against this
//     table; the `purchase_orders.supplier_id` FK relies on the row surviving.

import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('suppliers')
@Unique(['supplierCode', 'instanceId'])
export class SupplierEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  supplierCode!: string;

  @Column({ type: 'varchar', length: 256 })
  supplierName!: string;

  /** Tax registration number (RFC for MX, EIN for US, BN for CA). */
  @Column({ type: 'varchar', length: 32, nullable: true })
  taxId!: string | null;

  /** ISO 3166-1 alpha-2 country code. */
  @Column({ type: 'varchar', length: 2 })
  country!: string;

  /** ISO 4217 currency code. */
  @Column({ type: 'varchar', length: 3 })
  currencyCode!: string;

  /** Free-text payment terms from the source ERP (e.g. "NET30"). */
  @Column({ type: 'varchar', length: 64, nullable: true })
  payTerms!: string | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  addressLine1!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  city!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  stateProvince!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'ACTIVE' })
  status!: string;

  @Column({ type: 'int' })
  instanceId!: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastSyncedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}

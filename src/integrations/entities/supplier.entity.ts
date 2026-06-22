// Canonical schema per the unified Martinrea AP data model (Roshni / DAT-01).
// Mirrors the shared `suppliers` table: a single global supplier master keyed
// by `supplier_code` (no per-instance dimension). The Epicor sync maps every
// plant's vendor master onto this one table.
//
// Key invariants:
//   - `supplier_code` is globally unique (the canonical key invoices + POs
//     reference). Epicor `VendorNum` (US/CA) / `CodigoProveedor` (MX) is used
//     verbatim as the code.
//   - `payment_terms_days` is an integer (e.g. 30), not a free-text term.
//   - Active state is the boolean `is_active`.
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

@Entity('suppliers')
@Unique(['supplierCode'])
export class SupplierEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  supplierCode!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  /** Tax registration number (RFC for MX, EIN for US, BN for CA). Nullable. */
  @Column({ type: 'varchar', length: 60, nullable: true })
  taxId!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  address!: string | null;

  /** ISO 4217 currency code. */
  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string;

  /** ISO 3166-1 alpha-2 country code. */
  @Column({ type: 'varchar', length: 2, nullable: true })
  countryCode!: string | null;

  /** Payment terms in days (e.g. 30, 45, 60). */
  @Column({ type: 'int', nullable: true })
  paymentTermsDays!: number | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}

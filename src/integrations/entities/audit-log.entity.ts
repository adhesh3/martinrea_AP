// ⚠️  PLACEHOLDER ENTITY — `audit_logs` is owned by Roshni (Data track).
//
// This file exists so `CfdiValidationService.writeAuditLog(...)` has a
// TypeORM model to compile + insert against. The canonical schema lives in
// Roshni's data module as a `sequelize-typescript` model — we cannot import
// that directly (our codebase is TypeORM), so we maintain a parallel
// TypeORM entity here whose **column shape matches her spec byte-for-byte**.
//
// Column shape sourced from `schema_spec` (DAT-01) §4 and confirmed against
// Roshni's `AuditLog` sequelize model:
//   - action_type   VARCHAR(60)  NOT NULL
//   - invoice_id    UUID         nullable, FK → invoices.id
//   - performed_by  UUID         nullable, FK → users.id
//   - old_value     JSONB        nullable
//   - new_value     JSONB        nullable
//   - notes         VARCHAR(500) nullable
//   - created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()  (no updated_at)
//
// FK relationships and the append-only trigger are intentionally NOT
// declared here — they live in Roshni's migration. Our entity just needs
// the column types to line up so inserts succeed against the production
// schema.
//
// CRITICAL INVARIANT (per Roshni's spec, DAT-04):
//   `audit_logs` is INSERT-ONLY. A Postgres trigger on the table rejects
//   any UPDATE or DELETE statement. Our code never issues either one — we
//   only ever call `.insert()` for brand-new rows. Do NOT add an
//   `@UpdateDateColumn`, `@DeleteDateColumn`, or any code path that
//   mutates an existing row.

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('audit_logs')
// Single-column indexes per spec (invoice_id, performed_by, created_at,
// action_type). These four cover the lookup patterns Roshni's downstream
// services use: "all events for invoice X", "all actions by user Y",
// "events in the last 7 days", "every CFDI_VALIDATED row".
@Index(['invoiceId'])
@Index(['performedBy'])
@Index(['createdAt'])
@Index(['actionType'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * What happened. CFDI validation uses `'CFDI_VALIDATED'`; other modules
   * will define their own action types (e.g. `'INVOICE_APPROVED'`,
   * `'STATUS_CHANGED'`).
   *
   * Length is `60` per Roshni's spec — do NOT widen without coordinating
   * with her; the production trigger may also gate on this length.
   */
  @Column({ type: 'varchar', length: 60 })
  actionType!: string;

  /**
   * Subject AP invoice. FK → `invoices.id` in Roshni's migration (we do not
   * declare the FK here; it's enforced at the DB layer).
   *
   * Callers must pass a real UUID string. Passing `'inv-123'` or any other
   * non-UUID will fail at the Postgres level with
   * `invalid input syntax for type uuid`. The unit tests use placeholder
   * ids like `'inv-1'` because the repository is mocked there — that does
   * NOT work against a real database.
   */
  @Column({ type: 'uuid', nullable: true })
  invoiceId!: string | null;

  /**
   * User id of the actor. `null` for system / automated actions (CFDI
   * validation, nightly Epicor sync, etc.). FK → `users.id` in Roshni's
   * migration with `ON DELETE SET NULL` so a deleted user never wipes
   * historical rows.
   */
  @Column({ type: 'uuid', nullable: true })
  performedBy!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  oldValue!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  newValue!: Record<string, unknown> | null;

  /**
   * Free-text note. Length is `500` per Roshni's spec — anything longer
   * must be truncated by the writer or moved into `new_value` as JSONB.
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  notes!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

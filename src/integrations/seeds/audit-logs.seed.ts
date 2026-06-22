// Dev-only seed for the `audit_logs` table (Roshni's DAT-01 table — must
// already exist). Run with: npm run seed:audit
// Inserts the rows CfdiValidationService.writeAuditLog produces, one per
// CFDI outcome. Idempotent (deterministic UUID PKs + .orIgnore()).

import 'reflect-metadata';

import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { AuditLogEntity } from '../entities/audit-log.entity';

const AUDIT_IDS = {
  vigente: '77777777-7777-7777-7777-777777777001',
  cancelado: '77777777-7777-7777-7777-777777777002',
  noEncontrado: '77777777-7777-7777-7777-777777777003',
  satUnavailable: '77777777-7777-7777-7777-777777777004',
  structurallyInvalid: '77777777-7777-7777-7777-777777777005',
} as const;

// Optional positional override (`AUDIT_SEED_INVOICE_IDS="<uuid>,<uuid>,..."`)
// to link rows to real invoices.id; falls back to NULL (FK allows NULL).
function invoiceIdAt(index: number): string | null {
  const raw = process.env.AUDIT_SEED_INVOICE_IDS;
  if (!raw) return null;
  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return ids[index] ?? null;
}

function buildDataSource(): DataSource {
  return new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? 'martinrea_ap',
    username: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASS ?? 'postgres',
    entities: [AuditLogEntity],
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false,
    logging: ['error', 'warn'],
  });
}

function buildAuditRows(): Array<{
  id: string;
  actionType: string;
  invoiceId: string | null;
  performedBy: null;
  oldValue: null;
  newValue: Record<string, unknown>;
  notes: string;
  createdAt: Date;
}> {
  const minutesAgo = (n: number): Date => new Date(Date.now() - n * 60 * 1000);
  const uuid = '11111111-2222-3333-4444-555555555555';
  const emisorRfc = 'AAA010101AAA';
  const receptorRfc = 'MRE950101XYZ';

  return [
    {
      id: AUDIT_IDS.vigente,
      actionType: 'CFDI_VALIDATED',
      invoiceId: invoiceIdAt(0),
      performedBy: null,
      oldValue: null,
      newValue: {
        cfdiValid: true,
        satStatus: 'Vigente',
        uuid,
        emisorRfc,
        receptorRfc,
        total: 116000.0,
      },
      notes: 'CFDI validation completed',
      createdAt: minutesAgo(50),
    },
    {
      id: AUDIT_IDS.cancelado,
      actionType: 'CFDI_VALIDATED',
      invoiceId: invoiceIdAt(1),
      performedBy: null,
      oldValue: null,
      newValue: {
        cfdiValid: false,
        satStatus: 'Cancelado',
        uuid,
        emisorRfc,
        receptorRfc,
        total: 58000.0,
      },
      notes: 'Invoice cancelled in SAT system',
      createdAt: minutesAgo(40),
    },
    {
      id: AUDIT_IDS.noEncontrado,
      actionType: 'CFDI_VALIDATED',
      invoiceId: invoiceIdAt(2),
      performedBy: null,
      oldValue: null,
      newValue: {
        cfdiValid: false,
        satStatus: 'No Encontrado',
        uuid,
        emisorRfc,
        receptorRfc,
        total: 9250.5,
      },
      notes: 'Invoice UUID not found in SAT registry',
      createdAt: minutesAgo(30),
    },
    {
      id: AUDIT_IDS.satUnavailable,
      actionType: 'CFDI_VALIDATED',
      invoiceId: invoiceIdAt(3),
      performedBy: null,
      oldValue: null,
      newValue: {
        cfdiValid: true,
        satStatus: 'SAT_UNAVAILABLE',
        uuid,
        emisorRfc,
        receptorRfc,
        total: 312500.0,
      },
      notes: 'CFDI validation completed',
      createdAt: minutesAgo(20),
    },
    {
      id: AUDIT_IDS.structurallyInvalid,
      actionType: 'CFDI_VALIDATED',
      invoiceId: invoiceIdAt(4),
      performedBy: null,
      oldValue: null,
      newValue: {
        cfdiValid: false,
        satStatus: null,
        uuid: '',
        emisorRfc: '',
        receptorRfc: '',
        total: 0,
      },
      notes: 'Missing UUID, Invalid total format',
      createdAt: minutesAgo(10),
    },
  ];
}

async function seedAuditLogs(ds: DataSource): Promise<void> {
  await ds
    .createQueryBuilder()
    .insert()
    .into(AuditLogEntity)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .values(buildAuditRows() as any)
    .orIgnore()
    .execute();
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[seed:audit] Refusing to run with NODE_ENV=production. ' +
        'Sample data is dev/testing only.',
    );
  }

  const ds = buildDataSource();
  await ds.initialize();
  console.log(
    `[seed:audit] Connected to ${ds.options.database}@${(ds.options as { host?: string }).host}`,
  );

  try {
    await seedAuditLogs(ds);
    console.log('[seed:audit] audit_logs ✓ (5 CFDI_VALIDATED rows)');

    const total = await ds.getRepository(AuditLogEntity).count();
    const cfdi = await ds
      .getRepository(AuditLogEntity)
      .countBy({ actionType: 'CFDI_VALIDATED' });
    console.log(`[seed:audit] Row counts: audit_logs=${total} (CFDI_VALIDATED=${cfdi})`);
    console.log('[seed:audit] Done.');
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error('[seed:audit] FAILED:', err);
  process.exit(1);
});

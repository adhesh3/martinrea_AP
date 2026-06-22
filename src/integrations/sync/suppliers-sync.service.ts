import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  CanadaSupplierWire,
  MexicoSupplierWire,
  MockEpicorService,
  USSupplierWire,
} from '../../mock-epicor/mock-epicor.service';
import { EpicorInstance } from '../config/epicor-instances.config';
import { SupplierDto } from '../dto/supplier.dto';
import { SupplierEntity } from '../entities/supplier.entity';

export interface SupplierSyncCounts {
  fetched: number;
  inserted: number;
  updated: number;
  failed: number;
}

type RawSupplier = USSupplierWire | MexicoSupplierWire | CanadaSupplierWire;

/** US and Canada Epicor ship the same English `Vendor` field shape. */
type EnglishSupplierWire = USSupplierWire | CanadaSupplierWire;

/**
 * Worker for INT-01 (suppliers nightly sync).
 *
 * Pulls active suppliers from a single Epicor instance, normalises them onto
 * `SupplierDto`, and upserts into the canonical `suppliers` table via Postgres
 * `INSERT ... ON CONFLICT (supplier_code) DO UPDATE`. `supplier_code` is a
 * single global namespace (no per-instance dimension). Stateless — driven by
 * the orchestrator (`EpicorSyncService`).
 *
 * Currently sources its data from `MockEpicorService` (no real Epicor
 * credentials yet). To switch to live Epicor, replace the body of
 * `fetchSuppliersFromEpicor`.
 */
@Injectable()
export class SuppliersSyncService {
  private readonly logger = new Logger(SuppliersSyncService.name);

  constructor(
    private readonly mockEpicor: MockEpicorService,
    @InjectRepository(SupplierEntity)
    private readonly supplierRepo: Repository<SupplierEntity>,
  ) {}

  /**
   * Sync suppliers for a single Epicor instance.
   *
   * Step 1: simulate connection delay + pull raw rows from (mock) Epicor.
   * Step 2: normalise each raw row onto `SupplierDto`.
   * Step 3: bulk-upsert into the suppliers table.
   * Returns per-job counters the orchestrator persists to `sync_run_logs`.
   *
   * @param since  Watermark from the most recent SUCCESS run of this sub-job
   *               for this instance. `null` triggers a full pull (first run
   *               or post-failure recovery). A `Date` filters to records
   *               modified after that timestamp at the source ERP.
   */
  async syncForInstance(
    instance: EpicorInstance,
    since: Date | null = null,
  ): Promise<SupplierSyncCounts> {
    await this.mockEpicor.simulateConnectionDelay(instance.instanceId);
    const raw = await this.fetchSuppliersFromEpicor(instance, since);

    let failed = 0;
    const normalised: SupplierDto[] = [];

    for (const row of raw) {
      try {
        normalised.push(this.normalizeSupplier(row, instance));
      } catch (err) {
        failed += 1;
        this.logger.warn(
          `Failed to normalise supplier from instance ${instance.instanceId}: ${(err as Error).message}`,
        );
      }
    }

    const upsertResult = await this.upsertToDatabase(
      normalised,
      instance.instanceId,
    );

    this.logger.log(
      `[suppliers] instance=${instance.instanceId} ` +
        `mode=${since ? `incremental(since=${since.toISOString()})` : 'full'} ` +
        `fetched=${raw.length} inserted=${upsertResult.inserted} updated=${upsertResult.updated} failed=${failed}`,
    );

    return {
      fetched: raw.length,
      inserted: upsertResult.inserted,
      updated: upsertResult.updated,
      failed,
    };
  }

  /**
   * Pull supplier rows from Epicor.
   *
   * When `since` is provided, the real Epicor queries will add a
   * `WHERE LastModified > :since` predicate (or its SFTP equivalent — a
   * watermark-filtered export). The mock simulates this by returning a
   * smaller "changed since last sync" slice.
   *
   * TODO: Replace with real ODBC / SFTP connection.
   *   - US plants: `mssql` driver, query Vendor table.
   *     BAQ: `SELECT VendorNum, Name, VendorId, Country, InActive, LastModified
   *           FROM Vendor WHERE InActive = false AND LastModified > :since`
   *   - Mexico SFTP: parse CSV export from a scheduled Epicor report.
   *   - Canada SFTP: same shape as US, exported nightly.
   *   Credentials come from `EpicorInstance` (host/port/database/...).
   */
  private async fetchSuppliersFromEpicor(
    instance: EpicorInstance,
    since: Date | null,
  ): Promise<RawSupplier[]> {
    if (instance.region === 'US') {
      return this.mockEpicor.getUSSuppliers(instance.instanceId, since);
    }
    if (instance.region === 'MEXICO') {
      return this.mockEpicor.getMexicoSuppliers(instance.instanceId, since);
    }
    if (instance.region === 'CANADA') {
      return this.mockEpicor.getCanadaSuppliers(instance.instanceId, since);
    }
    // Defensive fallback for any future region not yet wired — log once and
    // return empty so the orchestrator records a clean SUCCESS with zero rows.
    this.logger.warn(
      `Region '${instance.region}' not yet wired (instance=${instance.instanceId}, plant=${instance.plantName}). Returning empty supplier list.`,
    );
    return [];
  }

  /**
   * Map a raw Epicor row onto the canonical `SupplierDto`.
   *
   * US/CA  : VendorNum→supplierCode, Name→supplierName, VendorId→taxId,
   *          Country→country (ISO alpha-2), CurrencyCode→currencyCode,
   *          PayTerms→payTerms,
   *          Address1/City/State→addressLine1/city/stateProvince,
   *          InActive===false→ACTIVE. (Canada Epicor uses the same English
   *          Vendor localisation as the US plants — only the currency 'CAD'
   *          and country 'CA' differ.)
   * Mexico : CodigoProveedor→supplierCode, NombreProveedor→supplierName,
   *          RFC→taxId, Pais→country (normalised to ISO 'MX'),
   *          Moneda→currencyCode, CondicionesPago→payTerms,
   *          Direccion/Ciudad/Estado→addressLine1/city/stateProvince,
   *          Activo===true→ACTIVE.
   */
  private normalizeSupplier(
    raw: RawSupplier,
    instance: EpicorInstance,
  ): SupplierDto {
    if (instance.region === 'MEXICO') {
      const r = raw as MexicoSupplierWire;
      return {
        // Deterministic id is seeded from `supplier_code` only: it is the
        // single global key, so the same supplier resolves to the same id
        // regardless of which instance happened to sync it.
        supplierId: deterministicUuid(r.CodigoProveedor),
        supplierCode: r.CodigoProveedor,
        supplierName: r.NombreProveedor,
        taxId: r.RFC ?? null,
        country: toIsoCountry(r.Pais),
        currencyCode: r.Moneda,
        payTerms: r.CondicionesPago ?? null,
        addressLine1: r.Direccion ?? null,
        city: r.Ciudad ?? null,
        stateProvince: r.Estado ?? null,
        status: r.Activo ? 'ACTIVE' : 'INACTIVE',
        instanceId: instance.instanceId,
        lastSyncedAt: new Date(),
      };
    }

    const r = raw as EnglishSupplierWire;
    return {
      // See note above: id seeded from `supplier_code` (globally unique).
      supplierId: deterministicUuid(r.VendorNum),
      supplierCode: r.VendorNum,
      supplierName: r.Name,
      taxId: r.VendorId ?? null,
      country: toIsoCountry(r.Country),
      currencyCode: r.CurrencyCode,
      payTerms: r.PayTerms ?? null,
      addressLine1: r.Address1 ?? null,
      city: r.City ?? null,
      stateProvince: r.State ?? null,
      status: r.InActive ? 'INACTIVE' : 'ACTIVE',
      instanceId: instance.instanceId,
      lastSyncedAt: new Date(),
    };
  }

  /**
   * Bulk-upsert normalised suppliers onto the canonical `suppliers` table via
   * Postgres `INSERT ... ON CONFLICT (supplier_code) DO UPDATE`.
   *
   * The internal `SupplierDto` is mapped onto the canonical columns here:
   *   supplierName → name, currencyCode → currency, country → country_code,
   *   payTerms ("NET30") → payment_terms_days (30), status → is_active,
   *   addressLine1 → address. `email`/`phone` aren't sourced from Epicor yet.
   *
   * Inserted vs updated counts are derived from the Postgres `xmax` system
   * column: `xmax = 0` for freshly-inserted rows, non-zero for rows that hit
   * the conflict path. Returned via `RETURNING (xmax = 0) AS created`.
   */
  async upsertToDatabase(
    suppliers: SupplierDto[],
    instanceId: number,
  ): Promise<SupplierSyncCounts> {
    if (suppliers.length === 0) {
      return { fetched: 0, inserted: 0, updated: 0, failed: 0 };
    }

    const values = suppliers.map((s) => ({
      id: s.supplierId,
      supplierCode: s.supplierCode,
      name: s.supplierName,
      taxId: s.taxId,
      email: null,
      phone: null,
      address: s.addressLine1,
      currency: s.currencyCode,
      countryCode: s.country,
      paymentTermsDays: parsePaymentTermsDays(s.payTerms),
      isActive: s.status === 'ACTIVE',
    }));

    const result = await this.supplierRepo
      .createQueryBuilder()
      .insert()
      .into(SupplierEntity)
      .values(values)
      // Snake_case here is deliberate: `.orUpdate(...)` accepts raw column
      // names and inserts them verbatim into the generated SQL. The
      // SnakeNamingStrategy in AppModule maps camelCase entity properties to
      // snake_case columns at the schema layer — but it does NOT rewrite
      // these literal strings, so they must already be in the target naming.
      .orUpdate(
        [
          'name',
          'tax_id',
          'email',
          'phone',
          'address',
          'currency',
          'country_code',
          'payment_terms_days',
          'is_active',
        ],
        ['supplier_code'],
      )
      .returning('"id", (xmax = 0) AS "created"')
      .execute();

    const rows = (result.raw ?? []) as Array<{
      id: string;
      created: boolean | number;
    }>;
    const inserted = rows.filter(
      (r) => r.created === true || r.created === 1,
    ).length;
    const updated = rows.length - inserted;

    this.logger.debug(
      `[suppliers] instance=${instanceId} upserted ${rows.length} row(s) (inserted=${inserted}, updated=${updated}).`,
    );

    return {
      fetched: suppliers.length,
      inserted,
      updated,
      failed: 0,
    };
  }
}

// ─── Helpers ───────────────────────────────────────────────────────

/**
 * Coerce a raw "country" string from Epicor onto an ISO 3166-1 alpha-2 code.
 * Required because Mexico Epicor ships `Pais = 'Mexico'` while the canonical
 * column expects two-letter codes.
 */
function toIsoCountry(raw: string): string {
  const normalised = raw.trim().toUpperCase();
  if (normalised === 'MEXICO' || normalised === 'MÉXICO') return 'MX';
  if (normalised === 'CANADA') return 'CA';
  if (normalised === 'UNITED STATES' || normalised === 'USA') return 'US';
  // Already a 2-letter code (US / MX / CA / ...) — keep as-is.
  return normalised.slice(0, 2);
}

/**
 * Parse Epicor's free-text payment terms onto the canonical integer day count.
 * Examples: "NET30" → 30, "Net 45" → 45, "30 DAYS" → 30, "COD" → 0.
 * Returns `null` when no number can be extracted (caller stores NULL).
 */
function parsePaymentTermsDays(payTerms: string | null): number | null {
  if (!payTerms) return null;
  const normalised = payTerms.trim().toUpperCase();
  if (normalised === 'COD' || normalised === 'CASH') return 0;
  const match = normalised.match(/(\d+)/);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

function deterministicUuid(seed: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let out = (h >>> 0).toString(16).padStart(8, '0');
  while (out.length < 32) {
    h = Math.imul(h ^ out.length, 0x01000193);
    out += (h >>> 0).toString(16).padStart(8, '0');
  }
  out = out.slice(0, 32);
  return `${out.slice(0, 8)}-${out.slice(8, 12)}-${out.slice(12, 16)}-${out.slice(16, 20)}-${out.slice(20, 32)}`;
}

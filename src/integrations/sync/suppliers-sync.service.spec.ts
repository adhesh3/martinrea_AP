import type { Repository } from 'typeorm';

import type { MockEpicorService } from '../../mock-epicor/mock-epicor.service';
import type { EpicorInstance } from '../config/epicor-instances.config';
import type { SupplierEntity } from '../entities/supplier.entity';
import { SuppliersSyncService } from './suppliers-sync.service';

interface FakeInsertResult {
  raw: Array<{ id: string; created: boolean }>;
}

function makeQueryBuilder(rows: FakeInsertResult['raw']) {
  const builder: Record<string, jest.Mock> = {};
  builder.insert = jest.fn(() => builder);
  builder.into = jest.fn(() => builder);
  builder.values = jest.fn(() => builder);
  builder.orUpdate = jest.fn(() => builder);
  builder.returning = jest.fn(() => builder);
  builder.execute = jest.fn(async () => ({ raw: rows }) as FakeInsertResult);
  return builder;
}

function makeRepo(rows: FakeInsertResult['raw'] = []) {
  const builder = makeQueryBuilder(rows);
  const repo = {
    createQueryBuilder: jest.fn(() => builder),
  };
  return { repo: repo as unknown as Repository<SupplierEntity>, builder };
}

const US_INSTANCE: EpicorInstance = {
  instanceId: 1,
  region: 'US',
  plantName: 'Test-US-Plant',
} as EpicorInstance;

const MX_INSTANCE: EpicorInstance = {
  instanceId: 21,
  region: 'MEXICO',
  plantName: 'Test-MX-Plant',
} as EpicorInstance;

// `normalizeSupplier` and `fetchSuppliersFromEpicor` are private — exercise
// them via the public `syncForInstance` entrypoint, asserting on the rows the
// fake repo's query builder ultimately receives.
function makeStubMockEpicor(
  overrides: Partial<MockEpicorService> = {},
): MockEpicorService {
  const base = {
    simulateConnectionDelay: jest.fn(async () => undefined),
    getUSSuppliers: jest.fn(() => []),
    getMexicoSuppliers: jest.fn(() => []),
  };
  return Object.assign(base, overrides) as unknown as MockEpicorService;
}

describe('SuppliersSyncService.upsertToDatabase', () => {
  it('1. empty array → returns { fetched:0, inserted:0, updated:0, failed:0 }', async () => {
    const { repo, builder } = makeRepo();
    const service = new SuppliersSyncService(makeStubMockEpicor(), repo);

    const result = await service.upsertToDatabase([], US_INSTANCE.instanceId);

    expect(result).toEqual({ fetched: 0, inserted: 0, updated: 0, failed: 0 });
    // No SQL should be issued for an empty batch — guards against accidental
    // INSERT INTO suppliers VALUES () failures.
    expect(builder.execute).not.toHaveBeenCalled();
  });

  it('2. three suppliers → calls createQueryBuilder + returns correct counts (2 inserted, 1 updated)', async () => {
    const rows = [
      { id: 'id-1', created: true },
      { id: 'id-2', created: true },
      { id: 'id-3', created: false },
    ];
    const { repo, builder } = makeRepo(rows);
    const service = new SuppliersSyncService(makeStubMockEpicor(), repo);

    const suppliers = [
      makeSupplierDto({ supplierId: 'id-1', supplierCode: 'V-1' }),
      makeSupplierDto({ supplierId: 'id-2', supplierCode: 'V-2' }),
      makeSupplierDto({ supplierId: 'id-3', supplierCode: 'V-3' }),
    ];

    const result = await service.upsertToDatabase(
      suppliers,
      US_INSTANCE.instanceId,
    );

    expect(repo.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(builder.execute).toHaveBeenCalledTimes(1);
    // Conflict target + update list match the spec verbatim.
    expect(builder.orUpdate).toHaveBeenCalledWith(
      ['supplier_name', 'tax_id', 'status', 'last_synced_at'],
      ['supplier_code', 'instance_id'],
    );
    expect(result).toEqual({
      fetched: 3,
      inserted: 2,
      updated: 1,
      failed: 0,
    });
  });
});

describe('SuppliersSyncService normalisation (via syncForInstance)', () => {
  it('3. normalizeUSSupplier maps VendorNum → supplierCode (and full field map)', async () => {
    const { repo, builder } = makeRepo([{ id: 'id-1', created: true }]);
    const mock = makeStubMockEpicor({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getUSSuppliers: jest.fn((() => [
        {
          VendorNum: 'V-10042',
          Name: 'Great Lakes Steel',
          VendorId: '38-4521890',
          Address1: '4400 Industrial Pkwy',
          City: 'Cleveland',
          State: 'OH',
          Country: 'US',
          InActive: false,
          VendorType: 'SUP',
          CurrencyCode: 'USD',
          PayTerms: 'NET30',
          instanceId: 1,
        },
      ])) as any,
    });
    const service = new SuppliersSyncService(mock, repo);

    await service.syncForInstance(US_INSTANCE);

    // Inspect the row that landed in `.values(...)`.
    const values = builder.values.mock.calls[0][0] as Array<
      Record<string, unknown>
    >;
    expect(values).toHaveLength(1);
    expect(values[0].supplierCode).toBe('V-10042');
    expect(values[0].supplierName).toBe('Great Lakes Steel');
    expect(values[0].taxId).toBe('38-4521890');
    expect(values[0].country).toBe('US');
    expect(values[0].currencyCode).toBe('USD');
    expect(values[0].payTerms).toBe('NET30');
    expect(values[0].city).toBe('Cleveland');
    expect(values[0].stateProvince).toBe('OH');
    expect(values[0].status).toBe('ACTIVE');
  });

  it('4. normalizeMexicoSupplier maps CodigoProveedor → supplierCode (and normalises Pais → MX)', async () => {
    const { repo, builder } = makeRepo([{ id: 'id-1', created: true }]);
    const mock = makeStubMockEpicor({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getMexicoSuppliers: jest.fn((() => [
        {
          CodigoProveedor: 'PROV-2041',
          NombreProveedor: 'Aceros del Norte',
          RFC: 'ANO850301ABC',
          Direccion: 'Blvd. Industrial 4521',
          Ciudad: 'Monterrey',
          Estado: 'Nuevo León',
          Pais: 'Mexico',
          Activo: true,
          TipoProveedor: 'PROVEEDOR',
          Moneda: 'MXN',
          CondicionesPago: 'NETO30',
          instanceId: 21,
        },
      ])) as any,
    });
    const service = new SuppliersSyncService(mock, repo);

    await service.syncForInstance(MX_INSTANCE);

    const values = builder.values.mock.calls[0][0] as Array<
      Record<string, unknown>
    >;
    expect(values[0].supplierCode).toBe('PROV-2041');
    expect(values[0].supplierName).toBe('Aceros del Norte');
    expect(values[0].taxId).toBe('ANO850301ABC');
    // Country must collapse to ISO 3166-1 alpha-2 — the entity column is
    // varchar(2), so `'Mexico'` would violate the schema.
    expect(values[0].country).toBe('MX');
    expect(values[0].currencyCode).toBe('MXN');
    expect(values[0].payTerms).toBe('NETO30');
  });

  it('5. Activo:true → ACTIVE, Activo:false → INACTIVE', async () => {
    const { repo, builder } = makeRepo([
      { id: 'id-1', created: true },
      { id: 'id-2', created: true },
    ]);
    const mock = makeStubMockEpicor({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getMexicoSuppliers: jest.fn((() => [
        {
          CodigoProveedor: 'PROV-1',
          NombreProveedor: 'Active vendor',
          RFC: 'AAA010101AAA',
          Direccion: 'X',
          Ciudad: 'X',
          Estado: 'X',
          Pais: 'Mexico',
          Activo: true,
          TipoProveedor: 'PROVEEDOR',
          Moneda: 'MXN',
          CondicionesPago: 'NETO30',
          instanceId: 21,
        },
        {
          CodigoProveedor: 'PROV-2',
          NombreProveedor: 'Inactive vendor',
          RFC: 'BBB010101BBB',
          Direccion: 'X',
          Ciudad: 'X',
          Estado: 'X',
          Pais: 'Mexico',
          Activo: false,
          TipoProveedor: 'PROVEEDOR',
          Moneda: 'MXN',
          CondicionesPago: 'NETO30',
          instanceId: 21,
        },
      ])) as any,
    });
    const service = new SuppliersSyncService(mock, repo);

    await service.syncForInstance(MX_INSTANCE);

    const values = builder.values.mock.calls[0][0] as Array<
      Record<string, unknown>
    >;
    expect(values[0].status).toBe('ACTIVE');
    expect(values[1].status).toBe('INACTIVE');
  });
});

describe('SuppliersSyncService.fetchSuppliersFromEpicor (since watermark)', () => {
  it('6. since=null → mock fetch called with null (full pull)', async () => {
    const { repo } = makeRepo();
    const mock = makeStubMockEpicor();
    const service = new SuppliersSyncService(mock, repo);

    await service.syncForInstance(US_INSTANCE, null);

    expect(mock.getUSSuppliers).toHaveBeenCalledWith(1, null);
  });

  it('7. since=Date → mock fetch called with that Date (incremental)', async () => {
    const { repo } = makeRepo();
    const mock = makeStubMockEpicor();
    const service = new SuppliersSyncService(mock, repo);
    const since = new Date('2026-05-25T12:00:00Z');

    await service.syncForInstance(US_INSTANCE, since);

    expect(mock.getUSSuppliers).toHaveBeenCalledWith(1, since);
  });
});

// ── Helpers ───────────────────────────────────────────────────────

function makeSupplierDto(
  overrides: Record<string, unknown> = {},
): import('../dto/supplier.dto').SupplierDto {
  return {
    supplierId: 'uuid-base',
    supplierCode: 'V-X',
    supplierName: 'Test Vendor',
    taxId: null,
    country: 'US',
    currencyCode: 'USD',
    payTerms: 'NET30',
    addressLine1: null,
    city: null,
    stateProvince: null,
    status: 'ACTIVE',
    instanceId: 1,
    lastSyncedAt: new Date(),
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

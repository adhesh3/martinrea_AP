import type { Repository } from 'typeorm';

import type { MockEpicorService } from '../../mock-epicor/mock-epicor.service';
import type { EpicorInstance } from '../config/epicor-instances.config';
import type { PurchaseOrderEntity } from '../entities/purchase-order.entity';
import { PurchaseOrdersSyncService } from './purchase-orders-sync.service';

const MX_INSTANCE: EpicorInstance = {
  instanceId: 21,
  region: 'MEXICO',
  plantName: 'Test-MX-Plant',
} as EpicorInstance;

const CA_INSTANCE: EpicorInstance = {
  instanceId: 35,
  region: 'CANADA',
  plantName: 'Test-CA-Plant',
} as EpicorInstance;

function makeQueryBuilder(rows: Array<{ id: string; created: boolean }> = []) {
  const qb: Record<string, jest.Mock> = {};
  qb.insert = jest.fn(() => qb);
  qb.into = jest.fn(() => qb);
  qb.values = jest.fn(() => qb);
  qb.orUpdate = jest.fn(() => qb);
  qb.returning = jest.fn(() => qb);
  qb.execute = jest.fn(async () => ({ raw: rows }));
  return qb;
}

/**
 * Fake `PurchaseOrderEntity` repo whose `createQueryBuilder` hands back a
 * recording builder. The canonical schema stores PO headers only, so
 * `upsertToDatabase` is a single header upsert — no transaction, no line repo.
 */
function makeRepo(rows: Array<{ id: string; created: boolean }> = []) {
  const builder = makeQueryBuilder(rows);
  const repo = {
    createQueryBuilder: jest.fn(() => builder),
  };
  return { repo: repo as unknown as Repository<PurchaseOrderEntity>, builder };
}

function makeStubMockEpicor(
  overrides: Partial<MockEpicorService> = {},
): MockEpicorService {
  const base = {
    simulateConnectionDelay: jest.fn(async () => undefined),
    getUSOpenPOs: jest.fn(() => []),
    getMexicoOpenPOs: jest.fn(() => []),
    getCanadaOpenPOs: jest.fn(() => []),
  };
  return Object.assign(base, overrides) as unknown as MockEpicorService;
}

describe('PurchaseOrdersSyncService.normalizePurchaseOrder', () => {
  it('8. normalizeMexicoPO maps NumOrden → poNumber, CodigoProveedor → supplierCode, OrdenAbierta→status', async () => {
    const { repo, builder } = makeRepo([{ id: 'po-uuid-1', created: true }]);
    const mock = makeStubMockEpicor({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getMexicoOpenPOs: jest.fn((() => [
        {
          NumOrden: 'PO-MX-9001',
          CodigoProveedor: 'PROV-2041',
          OrdenAbierta: true,
          Planta: 'MX-MTY-01',
          Moneda: 'MXN',
          TotalOrden: '15000.00',
          FechaRequerida: '2026-06-15',
          Lineas: [
            {
              NumLinea: 1,
              Descripcion: 'Acero rolado en frío',
              CantidadPedida: '100',
              CostoUnitario: '150.00',
              UnidadMedida: 'KG',
            },
          ],
          instanceId: 21,
        },
      ])) as any,
    });
    const service = new PurchaseOrdersSyncService(mock, repo);

    await service.syncForInstance(MX_INSTANCE);

    // The header builder received exactly one row with the normalised fields.
    const headerValues = builder.values.mock.calls[0][0] as Array<
      Record<string, unknown>
    >;
    expect(headerValues).toHaveLength(1);
    expect(headerValues[0].poNumber).toBe('PO-MX-9001');
    expect(headerValues[0].supplierCode).toBe('PROV-2041');
    expect(headerValues[0].supplierName).toBe('PROV-2041');
    expect(headerValues[0].vendorCode).toBeNull();
    expect(headerValues[0].status).toBe('OPEN');
    expect(headerValues[0].currency).toBe('MXN');
    expect(headerValues[0].plantId).toBe('MX-MTY-01');
    // NUMERIC columns are serialised to strings before insertion.
    expect(headerValues[0].totalAmount).toBe('15000.00');
  });

  it('8b. normalizeCanadaPO uses the English path (PONum → poNumber, CAD currency, plant)', async () => {
    const { repo, builder } = makeRepo([{ id: 'po-uuid-ca', created: true }]);
    const mock = makeStubMockEpicor({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getCanadaOpenPOs: jest.fn((() => [
        {
          PONum: 'PO-CA-2024-00310',
          VendorNum: 'V-20051',
          OrderDate: '2024-11-14',
          NeedByDate: '2024-12-02',
          OpenOrder: true,
          BuyerID: 'BUYER-CA1',
          CurrencyCode: 'CAD',
          TotalOrderAmt: 70300,
          Plant: 'VGN-MFG',
          Lines: [
            {
              LineNum: 1,
              PartNum: 'STL-CL-HR-055',
              LineDesc: 'Hot Rolled Steel Coil 0.055" Gauge',
              OrderQty: 28,
              UOM: 'TON',
              UnitCost: 1180.0,
              ExtCost: 33040,
              OpenLine: true,
            },
          ],
          instanceId: 35,
        },
      ])) as any,
    });
    const service = new PurchaseOrdersSyncService(mock, repo);

    await service.syncForInstance(CA_INSTANCE);

    expect(mock.getCanadaOpenPOs).toHaveBeenCalledWith(35, null);
    const headerValues = builder.values.mock.calls[0][0] as Array<
      Record<string, unknown>
    >;
    expect(headerValues).toHaveLength(1);
    expect(headerValues[0].poNumber).toBe('PO-CA-2024-00310');
    expect(headerValues[0].supplierCode).toBe('V-20051');
    expect(headerValues[0].status).toBe('OPEN');
    expect(headerValues[0].currency).toBe('CAD');
    expect(headerValues[0].plantId).toBe('VGN-MFG');
  });
});

describe('PurchaseOrdersSyncService.upsertToDatabase', () => {
  it('9. performs a single header upsert with conflict on po_number (no line table writes)', async () => {
    const { repo, builder } = makeRepo([{ id: 'po-uuid-1', created: true }]);
    const mock = makeStubMockEpicor({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getMexicoOpenPOs: jest.fn((() => [
        makeMxPoWire('PO-1', [
          { line: 1, qty: '10', cost: '5.00' },
          { line: 2, qty: '20', cost: '7.50' },
        ]),
      ])) as any,
    });
    const service = new PurchaseOrdersSyncService(mock, repo);

    await service.syncForInstance(MX_INSTANCE);

    // Exactly one query builder + one execute: headers only, no transaction,
    // no line delete/insert.
    expect(repo.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(builder.execute).toHaveBeenCalledTimes(1);
    // Conflict target is the global po_number; update list is the canonical
    // header column set.
    expect(builder.orUpdate).toHaveBeenCalledWith(
      [
        'supplier_code',
        'vendor_code',
        'supplier_name',
        'plant_id',
        'currency',
        'total_amount',
        'status',
        'issued_date',
        'expected_delivery_date',
        'notes',
      ],
      ['po_number'],
    );
    // A single header row is written regardless of how many source lines exist.
    const headerValues = builder.values.mock.calls[0][0] as Array<
      Record<string, unknown>
    >;
    expect(headerValues).toHaveLength(1);
    expect(headerValues[0].poNumber).toBe('PO-1');
  });
});

// ── Helpers ───────────────────────────────────────────────────────

function makeMxPoWire(
  poNum: string,
  lines: Array<{ line: number; qty: string; cost: string }> = [
    { line: 1, qty: '1', cost: '1.00' },
  ],
) {
  return {
    NumOrden: poNum,
    CodigoProveedor: 'PROV-X',
    OrdenAbierta: true,
    Planta: 'MX-X',
    Moneda: 'MXN',
    TotalOrden: '0',
    FechaRequerida: '2026-06-15',
    Lineas: lines.map((l) => ({
      NumLinea: l.line,
      Descripcion: 'Line',
      CantidadPedida: l.qty,
      CostoUnitario: l.cost,
      UnidadMedida: 'KG',
    })),
    instanceId: 21,
  };
}

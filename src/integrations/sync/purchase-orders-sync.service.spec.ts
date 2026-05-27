import type { DataSource, EntityManager, Repository } from 'typeorm';

import type { MockEpicorService } from '../../mock-epicor/mock-epicor.service';
import type { EpicorInstance } from '../config/epicor-instances.config';
import { PurchaseOrderLineEntity } from '../entities/purchase-order-line.entity';
import { PurchaseOrderEntity } from '../entities/purchase-order.entity';
import { PurchaseOrdersSyncService } from './purchase-orders-sync.service';

const MX_INSTANCE: EpicorInstance = {
  instanceId: 21,
  region: 'MEXICO',
  plantName: 'Test-MX-Plant',
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
 * Build a fake `EntityManager` that records `.createQueryBuilder` and
 * `.delete` calls. The transaction callback in
 * `PurchaseOrdersSyncService.upsertToDatabase` calls these in a fixed order
 * — the tests assert on that ordering.
 */
function makeFakeManager(headerRows: Array<{ id: string; created: boolean }>) {
  const headerBuilder = makeQueryBuilder(headerRows);
  const lineBuilder = makeQueryBuilder([]);
  let qbCallIndex = 0;
  const manager = {
    createQueryBuilder: jest.fn(() => {
      // First call inside the transaction is the header upsert, second is
      // the bulk line insert. Hand out the appropriate builder each time so
      // tests can assert on both independently.
      const builder = qbCallIndex === 0 ? headerBuilder : lineBuilder;
      qbCallIndex += 1;
      return builder;
    }),
    delete: jest.fn(async () => ({ affected: 0 })),
  };
  return { manager, headerBuilder, lineBuilder };
}

function makeFakeDataSource(headerRows: Array<{ id: string; created: boolean }>) {
  const fakeMgr = makeFakeManager(headerRows);
  const dataSource = {
    transaction: jest.fn(
      async (cb: (mgr: EntityManager) => Promise<unknown>) => {
        return cb(fakeMgr.manager as unknown as EntityManager);
      },
    ),
  };
  return { dataSource: dataSource as unknown as DataSource, fakeMgr };
}

function makeStubMockEpicor(
  overrides: Partial<MockEpicorService> = {},
): MockEpicorService {
  const base = {
    simulateConnectionDelay: jest.fn(async () => undefined),
    getUSOpenPOs: jest.fn(() => []),
    getMexicoOpenPOs: jest.fn(() => []),
  };
  return Object.assign(base, overrides) as unknown as MockEpicorService;
}

describe('PurchaseOrdersSyncService.normalizePurchaseOrder', () => {
  it('8. normalizeMexicoPO maps NumOrden → poNumber, CodigoProveedor → supplierCode, OrdenAbierta→status', async () => {
    const { dataSource, fakeMgr } = makeFakeDataSource([
      { id: 'po-uuid-1', created: true },
    ]);
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
    const poRepo = {} as Repository<PurchaseOrderEntity>;
    const poLineRepo = {} as Repository<PurchaseOrderLineEntity>;
    const service = new PurchaseOrdersSyncService(
      mock,
      poRepo,
      poLineRepo,
      dataSource,
    );

    await service.syncForInstance(MX_INSTANCE);

    // The header builder received exactly one row with the normalised fields.
    const headerValues = fakeMgr.headerBuilder.values.mock.calls[0][0] as Array<
      Record<string, unknown>
    >;
    expect(headerValues).toHaveLength(1);
    expect(headerValues[0].poNumber).toBe('PO-MX-9001');
    expect(headerValues[0].supplierCode).toBe('PROV-2041');
    expect(headerValues[0].status).toBe('OPEN');
    expect(headerValues[0].currency).toBe('MXN');
    expect(headerValues[0].plantId).toBe('MX-MTY-01');
    // NUMERIC columns are serialised to strings before insertion.
    expect(headerValues[0].totalAmount).toBe('15000.00');
  });
});

describe('PurchaseOrdersSyncService.upsertToDatabase', () => {
  it('9. wraps work in dataSource.transaction (single atomic unit)', async () => {
    const { dataSource, fakeMgr } = makeFakeDataSource([
      { id: 'po-uuid-1', created: true },
    ]);
    const mock = makeStubMockEpicor({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getMexicoOpenPOs: jest.fn((() => [makeMxPoWire('PO-1')])) as any,
    });
    const service = new PurchaseOrdersSyncService(
      mock,
      {} as Repository<PurchaseOrderEntity>,
      {} as Repository<PurchaseOrderLineEntity>,
      dataSource,
    );

    await service.syncForInstance(MX_INSTANCE);

    // Single `.transaction(...)` envelope around the entire write. Required
    // so a partial failure can never leave a PO without its lines.
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(fakeMgr.headerBuilder.execute).toHaveBeenCalledTimes(1);
  });

  it('10. lines are deleted then re-inserted (replace-all semantics)', async () => {
    const { dataSource, fakeMgr } = makeFakeDataSource([
      { id: 'po-uuid-1', created: false },
    ]);
    const mock = makeStubMockEpicor({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getMexicoOpenPOs: jest.fn((() => [
        makeMxPoWire('PO-2', [
          { line: 1, qty: '10', cost: '5.00' },
          { line: 2, qty: '20', cost: '7.50' },
        ]),
      ])) as any,
    });
    const service = new PurchaseOrdersSyncService(
      mock,
      {} as Repository<PurchaseOrderEntity>,
      {} as Repository<PurchaseOrderLineEntity>,
      dataSource,
    );

    await service.syncForInstance(MX_INSTANCE);

    // 1. Header upsert.
    expect(fakeMgr.headerBuilder.execute).toHaveBeenCalledTimes(1);
    // 2. Bulk delete of existing lines for these po_ids.
    expect(fakeMgr.manager.delete).toHaveBeenCalledTimes(1);
    const deleteArgs = fakeMgr.manager.delete.mock.calls[0] as unknown[];
    expect(deleteArgs[0]).toBe(PurchaseOrderLineEntity);
    // 3. Bulk insert of new lines — same builder, called once after delete.
    expect(fakeMgr.lineBuilder.execute).toHaveBeenCalledTimes(1);
    const lineValues = fakeMgr.lineBuilder.values.mock.calls[0][0] as Array<
      Record<string, unknown>
    >;
    expect(lineValues).toHaveLength(2);
    expect(lineValues[0].lineNumber).toBe(1);
    expect(lineValues[1].lineNumber).toBe(2);
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

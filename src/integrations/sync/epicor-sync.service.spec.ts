import {
  EPICOR_INSTANCES,
  type EpicorInstance,
} from '../config/epicor-instances.config';
import { SyncJobType, SyncStatus } from '../entities/sync-run-log.entity';
import { EpicorSyncService } from './epicor-sync.service';
import type { PurchaseOrdersSyncService } from './purchase-orders-sync.service';
import type { SuppliersSyncService } from './suppliers-sync.service';

interface FakeRepo {
  saved: Array<Record<string, unknown>>;
  updates: Array<{ id: string; patch: Record<string, unknown> }>;
}

function makeFakeRepo() {
  const state: FakeRepo = { saved: [], updates: [] };
  return {
    state,
    create: (row: Record<string, unknown>) => row,
    save: jest.fn(async (row: Record<string, unknown>) => {
      const id = `row-${state.saved.length + 1}`;
      const saved = { id, ...row };
      state.saved.push(saved);
      return saved;
    }),
    update: jest.fn(async (id: string, patch: Record<string, unknown>) => {
      state.updates.push({ id, patch });
      return { affected: 1 };
    }),
    // Used by `EpicorSyncService.getLastSuccessfulRunTime()` to look up the
    // incremental watermark. Returning `null` mirrors the "no prior SUCCESS
    // row exists" first-run path, which is what these tests assume — the
    // syncers receive `since = null` and behave as full-pull.
    findOne: jest.fn(async () => null),
  };
}

const ZERO = { fetched: 0, inserted: 0, updated: 0, failed: 0 };

function makeService(opts: {
  suppliersImpl: () => Promise<typeof ZERO>;
  posImpl: () => Promise<typeof ZERO>;
}) {
  const repo = makeFakeRepo();
  const suppliersSync = {
    syncForInstance: jest.fn(opts.suppliersImpl),
  } as unknown as SuppliersSyncService;
  const posSync = {
    syncForInstance: jest.fn(opts.posImpl),
  } as unknown as PurchaseOrdersSyncService;

  // Minimal ConfigService stub — `get(key)` always returns undefined, which
  // makes `sendAlert(...)` fall through to its `[ALERT MOCK]` console branch.
  const configService = {
    get: jest.fn(() => undefined),
  };

  const service = new EpicorSyncService(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    repo as any,
    suppliersSync,
    posSync,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    configService as any,
  );
  return { service, repo, suppliersSync, posSync };
}

const SAMPLE_INSTANCE: EpicorInstance = EPICOR_INSTANCES[0];

describe('EpicorSyncService.runSyncForInstance', () => {
  it('1. Both suppliers and POs succeed → status: SUCCESS', async () => {
    const { service } = makeService({
      suppliersImpl: async () => ({
        fetched: 5,
        inserted: 5,
        updated: 0,
        failed: 0,
      }),
      posImpl: async () => ({
        fetched: 7,
        inserted: 7,
        updated: 0,
        failed: 0,
      }),
    });
    const result = await service.runSyncForInstance(SAMPLE_INSTANCE);
    expect(result.overallStatus).toBe('SUCCESS');
    expect(result.suppliersResult.fetched).toBe(5);
    expect(result.posResult.fetched).toBe(7);
    expect(result.error).toBeUndefined();
  });

  it('2. Suppliers succeed, POs fail → status: PARTIAL', async () => {
    const { service } = makeService({
      suppliersImpl: async () => ({
        fetched: 5,
        inserted: 5,
        updated: 0,
        failed: 0,
      }),
      posImpl: async () => {
        throw new Error('Epicor POs query timeout');
      },
    });
    const result = await service.runSyncForInstance(SAMPLE_INSTANCE);
    expect(result.overallStatus).toBe('PARTIAL');
    expect(result.suppliersResult.fetched).toBe(5);
    expect(result.posResult).toEqual(ZERO);
    expect(result.error).toContain('Epicor POs query timeout');
  });

  it('3. Both suppliers and POs fail → status: FAILED', async () => {
    const { service } = makeService({
      suppliersImpl: async () => {
        throw new Error('suppliers blew up');
      },
      posImpl: async () => {
        throw new Error('pos blew up');
      },
    });
    const result = await service.runSyncForInstance(SAMPLE_INSTANCE);
    expect(result.overallStatus).toBe('FAILED');
    expect(result.suppliersResult).toEqual(ZERO);
    expect(result.posResult).toEqual(ZERO);
    expect(result.error).toContain('suppliers blew up');
    expect(result.error).toContain('pos blew up');
  });
});

describe('EpicorSyncService.getLastSuccessfulRunTime', () => {
  it('19. returns null when no SUCCESS rows exist for this (instance, jobType)', async () => {
    const { service, repo } = makeService({
      suppliersImpl: async () => ZERO,
      posImpl: async () => ZERO,
    });
    // makeFakeRepo already wires findOne → null; this is the first-run path.
    (repo.findOne as jest.Mock).mockResolvedValueOnce(null);

    const result = await service.getLastSuccessfulRunTime(
      42,
      SyncJobType.SUPPLIERS,
    );

    expect(result).toBeNull();
    expect(repo.findOne).toHaveBeenCalledWith({
      where: {
        instanceId: 42,
        jobType: SyncJobType.SUPPLIERS,
        status: SyncStatus.SUCCESS,
      },
      // Most-recent-first — the row at the top of the ordering wins.
      order: { completedAt: 'DESC' },
    });
  });

  it('20. returns most recent completedAt when a SUCCESS row exists', async () => {
    const lastSuccess = new Date('2026-05-25T01:30:00Z');
    const { service, repo } = makeService({
      suppliersImpl: async () => ZERO,
      posImpl: async () => ZERO,
    });
    (repo.findOne as jest.Mock).mockResolvedValueOnce({
      completedAt: lastSuccess,
    });

    const result = await service.getLastSuccessfulRunTime(
      7,
      SyncJobType.PURCHASE_ORDERS,
    );

    expect(result).toBe(lastSuccess);
  });
});

describe('EpicorSyncService.runFullSync', () => {
  it('4. One instance failing does not stop the others (Promise.allSettled)', async () => {
    let calls = 0;
    const { service, suppliersSync, posSync } = makeService({
      suppliersImpl: async () => {
        calls += 1;
        if (calls === 1) {
          throw new Error('first instance suppliers failed');
        }
        return { fetched: 1, inserted: 1, updated: 0, failed: 0 };
      },
      posImpl: async () => ({
        fetched: 1,
        inserted: 1,
        updated: 0,
        failed: 0,
      }),
    });

    await service.runFullSync('MANUAL');

    // We expect every active instance to have had `syncForInstance` called
    // for both suppliers and POs, regardless of the first failure.
    const totalActive = EPICOR_INSTANCES.filter((i) => i.isActive).length;
    expect(
      (suppliersSync.syncForInstance as jest.Mock).mock.calls.length,
    ).toBe(totalActive);
    expect(
      (posSync.syncForInstance as jest.Mock).mock.calls.length,
    ).toBe(totalActive);
  });
});

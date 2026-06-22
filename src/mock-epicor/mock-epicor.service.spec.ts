import { CANADA_SUPPLIERS } from './data/canada-suppliers.mock';
import { MEXICO_SUPPLIERS } from './data/mexico-suppliers.mock';
import { US_SUPPLIERS } from './data/us-suppliers.mock';
import {
  CONNECTION_REFUSED_ERROR,
  MockEpicorService,
} from './mock-epicor.service';

describe('MockEpicorService', () => {
  let service: MockEpicorService;

  beforeEach(() => {
    service = new MockEpicorService();
  });

  it('1. getUSSuppliers filters InActive === true', () => {
    // Sanity check: the fixture itself contains at least one inactive row,
    // otherwise this test would silently pass without exercising the filter.
    expect(US_SUPPLIERS.some((s) => s.InActive)).toBe(true);

    const result = service.getUSSuppliers(1);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((s) => s.InActive === false)).toBe(true);
  });

  it('2. getMexicoSuppliers filters Activo === false', () => {
    expect(MEXICO_SUPPLIERS.some((s) => !s.Activo)).toBe(true);

    const result = service.getMexicoSuppliers(21);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((s) => s.Activo === true)).toBe(true);
  });

  it('3. getUSGoodsReceipts returns [] for unknown PO', async () => {
    const result = await service.getUSGoodsReceipts(
      'PO-DOES-NOT-EXIST',
      1,
    );
    expect(result).toEqual([]);
  });

  it('4. getUSOpenPOs returns only OpenOrder === true', () => {
    // Cover every `instanceId % 4` bucket so the filter is exercised against
    // a representative slice of the fixture.
    for (const instanceId of [1, 2, 3, 4]) {
      const result = service.getUSOpenPOs(instanceId);
      expect(result.every((p) => p.OpenOrder === true)).toBe(true);
    }
  });

  it('5. instanceId % 3 returns correct counts', () => {
    // Service caps the target at the available active-supplier count, so the
    // expectations are derived from the fixture rather than hardcoded — this
    // keeps the test stable as new active suppliers are added.
    const activeCount = US_SUPPLIERS.filter((s) => !s.InActive).length;

    // instanceId % 3 === 0  → target 20
    expect(service.getUSSuppliers(3).length).toBe(Math.min(20, activeCount));
    // instanceId % 3 === 1  → target 22
    expect(service.getUSSuppliers(4).length).toBe(Math.min(22, activeCount));
    // instanceId % 3 === 2  → target 25 (default branch)
    expect(service.getUSSuppliers(5).length).toBe(Math.min(25, activeCount));
  });

  it('6. simulateConnectionDelay throws CONNECTION_REFUSED for instances 39-44 when Math.random < 0.3', async () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.1);

    try {
      for (const instanceId of [39, 40, 41, 42, 43, 44]) {
        await expect(
          service.simulateConnectionDelay(instanceId),
        ).rejects.toThrow(CONNECTION_REFUSED_ERROR);
      }
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('7. getCanadaSuppliers filters InActive === true', () => {
    // Sanity check: the fixture must contain at least one inactive row,
    // otherwise the filter would not actually be exercised.
    expect(CANADA_SUPPLIERS.some((s) => s.InActive)).toBe(true);

    const result = service.getCanadaSuppliers(35);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((s) => s.InActive === false)).toBe(true);
    // Canada Epicor ships CAD on the English Vendor shape.
    expect(result.every((s) => s.CurrencyCode === 'CAD')).toBe(true);
    expect(result.every((s) => s.Country === 'CA')).toBe(true);
  });

  it('8. getCanadaOpenPOs returns only OpenOrder === true', () => {
    const result = service.getCanadaOpenPOs(35);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((p) => p.OpenOrder === true)).toBe(true);
  });

  it('9. getCanadaGoodsReceipts matches a known PO and returns [] for unknown', async () => {
    const known = await service.getCanadaGoodsReceipts('PO-CA-2024-00310', 35);
    expect(known.length).toBeGreaterThan(0);
    expect(known.every((r) => r.PONum === 'PO-CA-2024-00310')).toBe(true);
    expect(known.every((r) => r.instanceId === 35)).toBe(true);

    const unknown = await service.getCanadaGoodsReceipts('PO-NOPE', 35);
    expect(unknown).toEqual([]);
  });
});

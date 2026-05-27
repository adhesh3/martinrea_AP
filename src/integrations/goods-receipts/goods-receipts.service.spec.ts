import type { MockEpicorService } from '../../mock-epicor/mock-epicor.service';
import { GoodsReceiptsService } from './goods-receipts.service';

// The pure methods under test never touch MockEpicorService — passing a
// no-op stub keeps the test focused on normalisation + pagination.
const stubMock = {} as unknown as MockEpicorService;

describe('GoodsReceiptsService', () => {
  let service: GoodsReceiptsService;

  beforeEach(() => {
    service = new GoodsReceiptsService(stubMock);
  });

  describe('normalizeUSFormat', () => {
    it('1. all fields map correctly', () => {
      const line = service.normalizeUSFormat({
        LineNum: 7,
        PartNum: 'PRT-100',
        PartDescription: 'Steel sheet 2mm',
        POLine: 1,
        OrderQty: 100,
        OurJobReceivedQty: 60,
        UnitCost: 12.5,
      });
      expect(line.lineNum).toBe(7);
      expect(line.description).toBe('Steel sheet 2mm');
      expect(line.orderedQty).toBe(100);
      expect(line.receivedQty).toBe(60);
      expect(line.unitPrice).toBe(12.5);
      expect(line.lineTotal).toBe(750);
    });

    it('3. zero receivedQty → lineTotal is 0', () => {
      const line = service.normalizeUSFormat({
        LineNum: 1,
        PartNum: 'PRT-100',
        PartDescription: 'Steel sheet',
        POLine: 1,
        OrderQty: 100,
        OurJobReceivedQty: 0,
        UnitCost: 12.5,
      });
      expect(line.receivedQty).toBe(0);
      expect(line.lineTotal).toBe(0);
    });

    it('4. missing field → returns 0 (not undefined)', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const line = service.normalizeUSFormat({} as any);
      expect(line.lineNum).toBe(0);
      expect(line.description).toBe('');
      expect(line.orderedQty).toBe(0);
      expect(line.receivedQty).toBe(0);
      expect(line.unitPrice).toBe(0);
      expect(line.lineTotal).toBe(0);
    });
  });

  describe('normalizeMexicoFormat', () => {
    it('2. all fields map correctly', () => {
      const line = service.normalizeMexicoFormat({
        NumLinea: 3,
        ClaveParte: 'ART-100',
        DescripcionArticulo: 'Lámina de acero',
        NumLineaOrden: 1,
        CantidadOrdenada: 100,
        CantidadRecibida: 50,
        CostoUnitario: 215.75,
      });
      expect(line.lineNum).toBe(3);
      expect(line.description).toBe('Lámina de acero');
      expect(line.orderedQty).toBe(100);
      expect(line.receivedQty).toBe(50);
      expect(line.unitPrice).toBe(215.75);
      expect(line.lineTotal).toBe(10787.5);
    });
  });

  describe('applyPagination', () => {
    it('5. page 1, limit 2, 5 items → hasMore: true', () => {
      const items = [1, 2, 3, 4, 5];
      const view = service.applyPagination(items, 1, 2);
      expect(view.paginatedData).toEqual([1, 2]);
      expect(view.total).toBe(5);
      expect(view.hasMore).toBe(true);
    });

    it('6. last page → hasMore: false', () => {
      const items = [1, 2, 3, 4, 5];
      const view = service.applyPagination(items, 3, 2);
      expect(view.paginatedData).toEqual([5]);
      expect(view.total).toBe(5);
      expect(view.hasMore).toBe(false);
    });
  });
});

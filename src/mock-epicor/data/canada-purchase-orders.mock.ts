/**
 * Mock Canada Epicor Purchase Order rows (header + lines).
 *
 * Same English shape as the US fixture (see `canada-suppliers.mock.ts` for why),
 * differing only in `CurrencyCode` (`CAD`), Canadian plant codes, and a
 * `PO-CA-` number prefix so Canadian POs are easy to tell apart from US ones
 * (`PO-2024-...`) and Mexican ones (`OC-...`).
 *
 * Mix:
 *   - 10 total POs
 *   - 8 OpenOrder=true (still receivable / invoiceable)
 *   - 2 OpenOrder=false (closed — to test sync filtering)
 */

export interface CanadaPurchaseOrderLine {
  LineNum: number;
  PartNum: string;
  LineDesc: string;
  OrderQty: number;
  UOM: 'EA' | 'LB' | 'TON' | 'GAL' | 'DRM' | 'BOX';
  UnitCost: number;
  ExtCost: number;
  OpenLine: boolean;
}

export interface CanadaPurchaseOrderRecord {
  PONum: string;
  VendorNum: string;
  OrderDate: string;
  NeedByDate: string;
  OpenOrder: boolean;
  BuyerID: string;
  CurrencyCode: 'CAD';
  TotalOrderAmt: number;
  Plant: 'VGN-MFG' | 'BRM-MFG' | 'TOR-MFG';
  Lines: CanadaPurchaseOrderLine[];
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

function makePO(args: {
  num: string;
  vendor: string;
  orderDate: string;
  needByDate: string;
  open: boolean;
  buyer?: string;
  plant: CanadaPurchaseOrderRecord['Plant'];
  lines: Array<
    Omit<CanadaPurchaseOrderLine, 'ExtCost' | 'OpenLine' | 'LineNum'> & {
      LineNum?: number;
      OpenLine?: boolean;
    }
  >;
}): CanadaPurchaseOrderRecord {
  const Lines: CanadaPurchaseOrderLine[] = args.lines.map((l, i) => ({
    LineNum: l.LineNum ?? i + 1,
    PartNum: l.PartNum,
    LineDesc: l.LineDesc,
    OrderQty: l.OrderQty,
    UOM: l.UOM,
    UnitCost: l.UnitCost,
    ExtCost: round2(l.OrderQty * l.UnitCost),
    OpenLine: l.OpenLine ?? args.open,
  }));
  return {
    PONum: args.num,
    VendorNum: args.vendor,
    OrderDate: args.orderDate,
    NeedByDate: args.needByDate,
    OpenOrder: args.open,
    BuyerID: args.buyer ?? 'BUYER-CA1',
    CurrencyCode: 'CAD',
    TotalOrderAmt: round2(Lines.reduce((acc, l) => acc + l.ExtCost, 0)),
    Plant: args.plant,
    Lines,
  };
}

export const CANADA_PURCHASE_ORDERS: CanadaPurchaseOrderRecord[] = [
  // ─── Steel coil POs (large $$$) ───────────────────────────────
  makePO({
    num: 'PO-CA-2024-00310',
    vendor: 'V-20051',
    orderDate: '2024-11-14',
    needByDate: '2024-12-02',
    open: true,
    plant: 'VGN-MFG',
    lines: [
      {
        PartNum: 'STL-CL-HR-055',
        LineDesc: 'Hot Rolled Steel Coil 0.055" Gauge',
        OrderQty: 28,
        UOM: 'TON',
        UnitCost: 1180.0,
      },
      {
        PartNum: 'STL-CL-HR-070',
        LineDesc: 'Hot Rolled Steel Coil 0.070" Gauge',
        OrderQty: 32,
        UOM: 'TON',
        UnitCost: 1165.0,
      },
    ],
  }),
  makePO({
    num: 'PO-CA-2024-00311',
    vendor: 'V-20052',
    orderDate: '2024-11-17',
    needByDate: '2024-12-06',
    open: true,
    plant: 'BRM-MFG',
    buyer: 'BUYER-CA2',
    lines: [
      {
        PartNum: 'STL-CL-CR-045',
        LineDesc: 'Cold Rolled Steel Coil 0.045" Gauge',
        OrderQty: 45,
        UOM: 'TON',
        UnitCost: 1240.0,
      },
    ],
  }),
  makePO({
    num: 'PO-CA-2024-00312',
    vendor: 'V-20053',
    orderDate: '2024-11-20',
    needByDate: '2024-12-11',
    open: true,
    plant: 'TOR-MFG',
    lines: [
      {
        PartNum: 'STL-CL-HSLA-060',
        LineDesc: 'HSLA Steel Coil 0.060" Gauge',
        OrderQty: 55,
        UOM: 'TON',
        UnitCost: 1460.0,
      },
      {
        PartNum: 'STL-CL-HSLA-080',
        LineDesc: 'HSLA Steel Coil 0.080" Gauge',
        OrderQty: 48,
        UOM: 'TON',
        UnitCost: 1525.0,
      },
    ],
  }),

  // ─── Tooling & mould POs (large $$$, multi-line) ──────────────
  makePO({
    num: 'PO-CA-2024-00420',
    vendor: 'V-20091',
    orderDate: '2024-10-09',
    needByDate: '2025-02-05',
    open: true,
    plant: 'VGN-MFG',
    buyer: 'BUYER-CA3',
    lines: [
      {
        PartNum: 'DIE-PRG-CA-A',
        LineDesc: 'Progressive Die - Cross Member',
        OrderQty: 1,
        UOM: 'EA',
        UnitCost: 162000.0,
      },
    ],
  }),
  makePO({
    num: 'PO-CA-2024-00421',
    vendor: 'V-20092',
    orderDate: '2024-10-15',
    needByDate: '2025-01-20',
    open: true,
    plant: 'BRM-MFG',
    buyer: 'BUYER-CA3',
    lines: [
      {
        PartNum: 'MLD-INJ-BRKT-A',
        LineDesc: 'Injection Mould - Bracket Housing',
        OrderQty: 1,
        UOM: 'EA',
        UnitCost: 84500.0,
      },
      {
        PartNum: 'MLD-INJ-BRKT-B',
        LineDesc: 'Injection Mould - Bracket Housing (RH variant)',
        OrderQty: 1,
        UOM: 'EA',
        UnitCost: 84500.0,
      },
    ],
  }),

  // ─── Lubricants / chemicals (medium) ──────────────────────────
  makePO({
    num: 'PO-CA-2024-00530',
    vendor: 'V-20211',
    orderDate: '2024-11-02',
    needByDate: '2024-11-21',
    open: true,
    plant: 'TOR-MFG',
    lines: [
      {
        PartNum: 'LUB-DRAW-HD-CA',
        LineDesc: 'Heavy-Duty Drawing Lubricant',
        OrderQty: 10,
        UOM: 'DRM',
        UnitCost: 2050.0,
      },
    ],
  }),

  // ─── Packaging (small-medium, multi-line) ─────────────────────
  makePO({
    num: 'PO-CA-2024-00640',
    vendor: 'V-20330',
    orderDate: '2024-11-12',
    needByDate: '2024-11-29',
    open: true,
    plant: 'VGN-MFG',
    lines: [
      {
        PartNum: 'PKG-COR-48x40-CA',
        LineDesc: 'Corrugated Cardboard Sheets 48"x40"',
        OrderQty: 4500,
        UOM: 'EA',
        UnitCost: 3.15,
      },
      {
        PartNum: 'PKG-STR-20K-CA',
        LineDesc: "Plastic Stretch Wrap 20\" x 1500'",
        OrderQty: 55,
        UOM: 'BOX',
        UnitCost: 102.0,
      },
    ],
  }),

  // ─── MRO (small, multi-line) ──────────────────────────────────
  makePO({
    num: 'PO-CA-2024-00750',
    vendor: 'V-20501',
    orderDate: '2024-11-19',
    needByDate: '2024-11-27',
    open: true,
    plant: 'BRM-MFG',
    lines: [
      {
        PartNum: 'MRO-FAS-M8x35-CA',
        LineDesc: 'Hex Bolt M8 x 35mm Class 10.9',
        OrderQty: 6000,
        UOM: 'EA',
        UnitCost: 0.49,
      },
      {
        PartNum: 'MRO-FAS-NUT-M8-CA',
        LineDesc: 'Hex Nut M8 Class 10',
        OrderQty: 6000,
        UOM: 'EA',
        UnitCost: 0.21,
      },
    ],
  }),

  // ─── Closed POs (2) — must be filtered out by sync ────────────
  makePO({
    num: 'PO-CA-2024-00120',
    vendor: 'V-20051',
    orderDate: '2024-09-11',
    needByDate: '2024-09-27',
    open: false,
    plant: 'VGN-MFG',
    lines: [
      {
        PartNum: 'STL-CL-HR-055',
        LineDesc: 'Hot Rolled Steel Coil 0.055" (Sept lot)',
        OrderQty: 22,
        UOM: 'TON',
        UnitCost: 1175.0,
      },
    ],
  }),
  makePO({
    num: 'PO-CA-2024-00121',
    vendor: 'V-20721',
    orderDate: '2024-09-20',
    needByDate: '2024-10-08',
    open: false,
    plant: 'TOR-MFG',
    lines: [
      {
        PartNum: 'FRT-LTL-TOR-VGN',
        LineDesc: 'LTL Freight Toronto→Vaughan (Sept)',
        OrderQty: 1,
        UOM: 'EA',
        UnitCost: 4200.0,
      },
    ],
  }),
];

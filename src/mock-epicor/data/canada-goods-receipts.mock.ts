/**
 * Mock Canada Epicor Goods Receipt rows (header + lines).
 *
 * Same English shape as the US fixture (`ReceiptHdr` / `ReceiptDtl`
 * localisation), keyed to the PO numbers in `canada-purchase-orders.mock.ts`.
 * Differs only in Canadian plant codes and the `PO-CA-` / `REC-CA-` prefixes.
 *
 * Scenarios covered (so three-way matching has something to chew on):
 *   - Fully received     (`OurJobReceivedQty === OrderQty`)
 *   - Partially received (`OurJobReceivedQty < OrderQty`)
 *   - Slight over-receipt within 2% tolerance
 *   - Multi-line + split (multi-receipt) deliveries
 */

export interface CanadaGoodsReceiptLine {
  LineNum: number;
  PartNum: string;
  PartDescription: string;
  POLine: number;
  OrderQty: number;
  OurJobReceivedQty: number;
  UnitCost: number;
  ReceivedAmt: number;
  LotNum: string;
  ReceivedComplete: boolean;
}

export interface CanadaGoodsReceiptRecord {
  ReceiptNum: string;
  PONum: string;
  VendorNum: string;
  ReceiptDate: string;
  Plant: 'VGN-MFG' | 'BRM-MFG' | 'TOR-MFG';
  Lines: CanadaGoodsReceiptLine[];
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const lot = (year: number, n: number): string =>
  `LOT-CA-${year}-${String(n).padStart(3, '0')}`;

interface MakeLineArgs {
  partNum: string;
  partDesc: string;
  poLine: number;
  ordered: number;
  received: number;
  unitCost: number;
  lotN: number;
}
function line(args: MakeLineArgs, lineNum: number): CanadaGoodsReceiptLine {
  const tol = args.ordered * 1.02;
  const complete = args.received >= args.ordered && args.received <= tol;
  return {
    LineNum: lineNum,
    PartNum: args.partNum,
    PartDescription: args.partDesc,
    POLine: args.poLine,
    OrderQty: args.ordered,
    OurJobReceivedQty: args.received,
    UnitCost: args.unitCost,
    ReceivedAmt: round2(args.received * args.unitCost),
    LotNum: lot(2024, args.lotN),
    ReceivedComplete: complete,
  };
}

interface MakeReceiptArgs {
  num: string;
  po: string;
  vendor: string;
  date: string;
  plant: CanadaGoodsReceiptRecord['Plant'];
  lines: MakeLineArgs[];
}
function receipt(args: MakeReceiptArgs): CanadaGoodsReceiptRecord {
  return {
    ReceiptNum: args.num,
    PONum: args.po,
    VendorNum: args.vendor,
    ReceiptDate: args.date,
    Plant: args.plant,
    Lines: args.lines.map((l, i) => line(l, i + 1)),
  };
}

export const CANADA_GOODS_RECEIPTS: CanadaGoodsReceiptRecord[] = [
  // ─── PO-CA-2024-00310 (V-20051, VGN-MFG) — 2 lines, split delivery
  receipt({
    num: 'REC-CA-2024-00310',
    po: 'PO-CA-2024-00310',
    vendor: 'V-20051',
    date: '2024-11-25',
    plant: 'VGN-MFG',
    lines: [
      {
        partNum: 'STL-CL-HR-055',
        partDesc: 'Hot Rolled Steel Coil 0.055" Gauge',
        poLine: 1,
        ordered: 28,
        received: 16,
        unitCost: 1180.0,
        lotN: 101,
      },
      {
        partNum: 'STL-CL-HR-070',
        partDesc: 'Hot Rolled Steel Coil 0.070" Gauge',
        poLine: 2,
        ordered: 32,
        received: 20,
        unitCost: 1165.0,
        lotN: 102,
      },
    ],
  }),
  receipt({
    num: 'REC-CA-2024-00315',
    po: 'PO-CA-2024-00310',
    vendor: 'V-20051',
    date: '2024-11-29',
    plant: 'VGN-MFG',
    lines: [
      {
        partNum: 'STL-CL-HR-055',
        partDesc: 'Hot Rolled Steel Coil 0.055" Gauge',
        poLine: 1,
        ordered: 28,
        received: 12,
        unitCost: 1180.0,
        lotN: 118,
      },
    ],
  }),

  // ─── PO-CA-2024-00311 (V-20052, BRM-MFG) — full single receipt
  receipt({
    num: 'REC-CA-2024-00330',
    po: 'PO-CA-2024-00311',
    vendor: 'V-20052',
    date: '2024-12-05',
    plant: 'BRM-MFG',
    lines: [
      {
        partNum: 'STL-CL-CR-045',
        partDesc: 'Cold Rolled Steel Coil 0.045" Gauge',
        poLine: 1,
        ordered: 45,
        received: 45,
        unitCost: 1240.0,
        lotN: 140,
      },
    ],
  }),

  // ─── PO-CA-2024-00312 (V-20053, TOR-MFG) — 2 lines, partial
  receipt({
    num: 'REC-CA-2024-00350',
    po: 'PO-CA-2024-00312',
    vendor: 'V-20053',
    date: '2024-12-10',
    plant: 'TOR-MFG',
    lines: [
      {
        partNum: 'STL-CL-HSLA-060',
        partDesc: 'HSLA Steel Coil 0.060" Gauge',
        poLine: 1,
        ordered: 55,
        received: 30,
        unitCost: 1460.0,
        lotN: 160,
      },
      {
        partNum: 'STL-CL-HSLA-080',
        partDesc: 'HSLA Steel Coil 0.080" Gauge',
        poLine: 2,
        ordered: 48,
        received: 24,
        unitCost: 1525.0,
        lotN: 161,
      },
    ],
  }),

  // ─── PO-CA-2024-00421 (V-20092, BRM-MFG) — moulds, fully received
  receipt({
    num: 'REC-CA-2024-00420',
    po: 'PO-CA-2024-00421',
    vendor: 'V-20092',
    date: '2025-01-18',
    plant: 'BRM-MFG',
    lines: [
      {
        partNum: 'MLD-INJ-BRKT-A',
        partDesc: 'Injection Mould - Bracket Housing',
        poLine: 1,
        ordered: 1,
        received: 1,
        unitCost: 84500.0,
        lotN: 180,
      },
      {
        partNum: 'MLD-INJ-BRKT-B',
        partDesc: 'Injection Mould - Bracket Housing (RH variant)',
        poLine: 2,
        ordered: 1,
        received: 1,
        unitCost: 84500.0,
        lotN: 181,
      },
    ],
  }),

  // ─── PO-CA-2024-00530 (V-20211, TOR-MFG) — partial lubricant
  receipt({
    num: 'REC-CA-2024-00530',
    po: 'PO-CA-2024-00530',
    vendor: 'V-20211',
    date: '2024-11-20',
    plant: 'TOR-MFG',
    lines: [
      {
        partNum: 'LUB-DRAW-HD-CA',
        partDesc: 'Heavy-Duty Drawing Lubricant',
        poLine: 1,
        ordered: 10,
        received: 5,
        unitCost: 2050.0,
        lotN: 200,
      },
    ],
  }),

  // ─── PO-CA-2024-00640 (V-20330, VGN-MFG) — packaging, slight over
  receipt({
    num: 'REC-CA-2024-00640',
    po: 'PO-CA-2024-00640',
    vendor: 'V-20330',
    date: '2024-11-28',
    plant: 'VGN-MFG',
    lines: [
      {
        partNum: 'PKG-COR-48x40-CA',
        partDesc: 'Corrugated Cardboard Sheets 48"x40"',
        poLine: 1,
        ordered: 4500,
        received: 4500,
        unitCost: 3.15,
        lotN: 220,
      },
      {
        partNum: 'PKG-STR-20K-CA',
        partDesc: "Plastic Stretch Wrap 20\" x 1500'",
        poLine: 2,
        ordered: 55,
        received: 56, // slight over, within 2%
        unitCost: 102.0,
        lotN: 221,
      },
    ],
  }),

  // ─── PO-CA-2024-00750 (V-20501, BRM-MFG) — MRO fasteners, full
  receipt({
    num: 'REC-CA-2024-00750',
    po: 'PO-CA-2024-00750',
    vendor: 'V-20501',
    date: '2024-11-26',
    plant: 'BRM-MFG',
    lines: [
      {
        partNum: 'MRO-FAS-M8x35-CA',
        partDesc: 'Hex Bolt M8 x 35mm Class 10.9',
        poLine: 1,
        ordered: 6000,
        received: 6000,
        unitCost: 0.49,
        lotN: 240,
      },
      {
        partNum: 'MRO-FAS-NUT-M8-CA',
        partDesc: 'Hex Nut M8 Class 10',
        poLine: 2,
        ordered: 6000,
        received: 5800,
        unitCost: 0.21,
        lotN: 241,
      },
    ],
  }),

  // ─── PO-CA-2024-00120 (closed PO, historical full receipt) ────
  receipt({
    num: 'REC-CA-2024-00120',
    po: 'PO-CA-2024-00120',
    vendor: 'V-20051',
    date: '2024-09-26',
    plant: 'VGN-MFG',
    lines: [
      {
        partNum: 'STL-CL-HR-055',
        partDesc: 'Hot Rolled Steel Coil 0.055" (Sept lot)',
        poLine: 1,
        ordered: 22,
        received: 22,
        unitCost: 1175.0,
        lotN: 90,
      },
    ],
  }),
];

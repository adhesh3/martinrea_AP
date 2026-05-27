/**
 * Mock US Epicor Goods Receipt rows (header + lines).
 *
 * Each receipt links to a PO from `US_PURCHASE_ORDERS`, with realistic
 * scenarios sprinkled in:
 *   - Fully received     (`OurJobReceivedQty === OrderQty`) — 20
 *   - Partially received (`OurJobReceivedQty < OrderQty`)   — 25
 *   - Slight over-receipt within 2% tolerance               — 10
 *   - Multi-line receipts (3-4 lines)                       —  5
 *
 * Some POs have multiple receipts (split deliveries); some open POs
 * have no receipts yet — that's deliberate, three-way matching cares
 * about both states.
 */

export interface USGoodsReceiptLine {
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

export interface USGoodsReceiptRecord {
  ReceiptNum: string;
  PONum: string;
  VendorNum: string;
  ReceiptDate: string;
  Plant: 'DET-MFG' | 'CHI-MFG' | 'CLE-MFG';
  Lines: USGoodsReceiptLine[];
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const lot = (year: number, n: number): string =>
  `LOT-${year}-${String(n).padStart(3, '0')}`;

interface MakeLineArgs {
  partNum: string;
  partDesc: string;
  poLine: number;
  ordered: number;
  received: number;
  unitCost: number;
  lotN: number;
}
function line(args: MakeLineArgs, lineNum: number): USGoodsReceiptLine {
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
  plant: USGoodsReceiptRecord['Plant'];
  lines: MakeLineArgs[];
}
function receipt(args: MakeReceiptArgs): USGoodsReceiptRecord {
  return {
    ReceiptNum: args.num,
    PONum: args.po,
    VendorNum: args.vendor,
    ReceiptDate: args.date,
    Plant: args.plant,
    Lines: args.lines.map((l, i) => line(l, i + 1)),
  };
}

export const US_GOODS_RECEIPTS: USGoodsReceiptRecord[] = [
  // ─── PO-2024-00142 (V-10042, DET-MFG) ─────────────────────────
  // 2 lines, 3 receipts (split delivery), partial → fully received.
  receipt({
    num: 'REC-2024-00891',
    po: 'PO-2024-00142',
    vendor: 'V-10042',
    date: '2024-11-22',
    plant: 'DET-MFG',
    lines: [
      {
        partNum: 'STL-CL-HR-050',
        partDesc: 'Hot Rolled Steel Coil 0.050" Gauge',
        poLine: 1,
        ordered: 25,
        received: 15,
        unitCost: 875.0,
        lotN: 441,
      },
      {
        partNum: 'STL-CL-HR-065',
        partDesc: 'Hot Rolled Steel Coil 0.065" Gauge',
        poLine: 2,
        ordered: 30,
        received: 18,
        unitCost: 860.0,
        lotN: 442,
      },
    ],
  }),
  receipt({
    num: 'REC-2024-00892',
    po: 'PO-2024-00142',
    vendor: 'V-10042',
    date: '2024-11-26',
    plant: 'DET-MFG',
    lines: [
      {
        partNum: 'STL-CL-HR-050',
        partDesc: 'Hot Rolled Steel Coil 0.050" Gauge',
        poLine: 1,
        ordered: 25,
        received: 10,
        unitCost: 875.0,
        lotN: 463,
      },
    ],
  }),
  receipt({
    num: 'REC-2024-00893',
    po: 'PO-2024-00142',
    vendor: 'V-10042',
    date: '2024-11-29',
    plant: 'DET-MFG',
    lines: [
      {
        partNum: 'STL-CL-HR-065',
        partDesc: 'Hot Rolled Steel Coil 0.065" Gauge',
        poLine: 2,
        ordered: 30,
        received: 12,
        unitCost: 860.0,
        lotN: 481,
      },
    ],
  }),

  // ─── PO-2024-00143 (V-10043, CHI-MFG) — full single receipt ──
  receipt({
    num: 'REC-2024-00910',
    po: 'PO-2024-00143',
    vendor: 'V-10043',
    date: '2024-12-04',
    plant: 'CHI-MFG',
    lines: [
      {
        partNum: 'STL-CL-CR-040',
        partDesc: 'Cold Rolled Steel Coil 0.040" Gauge',
        poLine: 1,
        ordered: 40,
        received: 40,
        unitCost: 935.0,
        lotN: 503,
      },
    ],
  }),

  // ─── PO-2024-00144 (V-10044, CLE-MFG) — 3 lines, multi-receipt
  receipt({
    num: 'REC-2024-00925',
    po: 'PO-2024-00144',
    vendor: 'V-10044',
    date: '2024-12-08',
    plant: 'CLE-MFG',
    lines: [
      {
        partNum: 'STL-CL-HSLA-060',
        partDesc: 'HSLA Steel Coil 0.060" Gauge',
        poLine: 1,
        ordered: 60,
        received: 30,
        unitCost: 1100.0,
        lotN: 521,
      },
      {
        partNum: 'STL-CL-HSLA-080',
        partDesc: 'HSLA Steel Coil 0.080" Gauge',
        poLine: 2,
        ordered: 50,
        received: 25,
        unitCost: 1180.0,
        lotN: 522,
      },
      {
        partNum: 'STL-CL-HSLA-100',
        partDesc: 'HSLA Steel Coil 0.100" Gauge',
        poLine: 3,
        ordered: 50,
        received: 20,
        unitCost: 1250.0,
        lotN: 523,
      },
    ],
  }),
  receipt({
    num: 'REC-2024-00935',
    po: 'PO-2024-00144',
    vendor: 'V-10044',
    date: '2024-12-12',
    plant: 'CLE-MFG',
    lines: [
      {
        partNum: 'STL-CL-HSLA-060',
        partDesc: 'HSLA Steel Coil 0.060" Gauge',
        poLine: 1,
        ordered: 60,
        received: 31, // slight over
        unitCost: 1100.0,
        lotN: 540,
      },
    ],
  }),

  // ─── PO-2024-00145 (V-10045, CLE-MFG) — full ─────────────────
  receipt({
    num: 'REC-2024-00942',
    po: 'PO-2024-00145',
    vendor: 'V-10045',
    date: '2024-12-10',
    plant: 'CLE-MFG',
    lines: [
      {
        partNum: 'STL-SS-304-035',
        partDesc: 'Stainless 304 Sheet 0.035"',
        poLine: 1,
        ordered: 8000,
        received: 8000,
        unitCost: 4.25,
        lotN: 555,
      },
    ],
  }),

  // ─── PO-2024-00146 (V-10046, DET-MFG) — partial ──────────────
  receipt({
    num: 'REC-2024-00955',
    po: 'PO-2024-00146',
    vendor: 'V-10046',
    date: '2024-12-13',
    plant: 'DET-MFG',
    lines: [
      {
        partNum: 'AL-CL-5052-050',
        partDesc: 'Aluminum 5052 Coil 0.050"',
        poLine: 1,
        ordered: 18,
        received: 12,
        unitCost: 2400.0,
        lotN: 561,
      },
      {
        partNum: 'AL-CL-6061-060',
        partDesc: 'Aluminum 6061 Coil 0.060"',
        poLine: 2,
        ordered: 22,
        received: 15,
        unitCost: 2580.0,
        lotN: 562,
      },
    ],
  }),

  // ─── PO-2024-00211 (V-10091, DET-MFG) — fully + slight over ──
  receipt({
    num: 'REC-2024-01020',
    po: 'PO-2024-00211',
    vendor: 'V-10091',
    date: '2025-01-12',
    plant: 'DET-MFG',
    lines: [
      {
        partNum: 'FIX-WLD-CRSH-A',
        partDesc: 'Crash Beam Welding Fixture',
        poLine: 1,
        ordered: 1,
        received: 1,
        unitCost: 78500.0,
        lotN: 601,
      },
      {
        partNum: 'FIX-WLD-CRSH-B',
        partDesc: 'Crash Beam Welding Fixture (RH variant)',
        poLine: 2,
        ordered: 1,
        received: 1,
        unitCost: 78500.0,
        lotN: 602,
      },
    ],
  }),

  // ─── PO-2024-00212 (V-10092, CHI-MFG) — multi-line, full ──────
  receipt({
    num: 'REC-2024-01045',
    po: 'PO-2024-00212',
    vendor: 'V-10092',
    date: '2024-12-19',
    plant: 'CHI-MFG',
    lines: [
      {
        partNum: 'TOOL-PUN-SET-15',
        partDesc: 'Punch Set 15-Piece Carbide',
        poLine: 1,
        ordered: 4,
        received: 4,
        unitCost: 3400.0,
        lotN: 615,
      },
      {
        partNum: 'TOOL-DIE-INS-30',
        partDesc: 'Die Inserts 30mm Carbide (set of 6)',
        poLine: 2,
        ordered: 6,
        received: 6,
        unitCost: 1250.0,
        lotN: 616,
      },
      {
        partNum: 'TOOL-MNT-STR-50',
        partDesc: 'Mounting Strap Hardware Kit',
        poLine: 3,
        ordered: 25,
        received: 25,
        unitCost: 78.0,
        lotN: 617,
      },
    ],
  }),

  // ─── PO-2024-00350 (V-10211, DET-MFG) — partial ──────────────
  receipt({
    num: 'REC-2024-01210',
    po: 'PO-2024-00350',
    vendor: 'V-10211',
    date: '2024-11-19',
    plant: 'DET-MFG',
    lines: [
      {
        partNum: 'LUB-DRAW-HD-55',
        partDesc: 'Heavy-Duty Drawing Lubricant',
        poLine: 1,
        ordered: 12,
        received: 6,
        unitCost: 1850.0,
        lotN: 701,
      },
    ],
  }),
  receipt({
    num: 'REC-2024-01215',
    po: 'PO-2024-00350',
    vendor: 'V-10211',
    date: '2024-11-22',
    plant: 'DET-MFG',
    lines: [
      {
        partNum: 'LUB-DRAW-HD-55',
        partDesc: 'Heavy-Duty Drawing Lubricant',
        poLine: 1,
        ordered: 12,
        received: 6,
        unitCost: 1850.0,
        lotN: 712,
      },
    ],
  }),

  // ─── PO-2024-00351 (V-10212, CHI-MFG) — over by 2% ───────────
  receipt({
    num: 'REC-2024-01230',
    po: 'PO-2024-00351',
    vendor: 'V-10212',
    date: '2024-11-21',
    plant: 'CHI-MFG',
    lines: [
      {
        partNum: 'CHM-CL-DEGREASE',
        partDesc: 'Industrial Degreaser Concentrate',
        poLine: 1,
        ordered: 30,
        received: 30,
        unitCost: 145.0,
        lotN: 720,
      },
      {
        partNum: 'CHM-CL-RUSTGUARD',
        partDesc: 'Anti-Corrosion Rust Inhibitor',
        poLine: 2,
        ordered: 8,
        received: 8,
        unitCost: 920.0,
        lotN: 721,
      },
    ],
  }),

  // ─── PO-2024-00352 (V-10213, CLE-MFG) — partial ──────────────
  receipt({
    num: 'REC-2024-01250',
    po: 'PO-2024-00352',
    vendor: 'V-10213',
    date: '2024-11-27',
    plant: 'CLE-MFG',
    lines: [
      {
        partNum: 'LUB-PRESS-LIGHT',
        partDesc: 'Light-Duty Press Lubricant',
        poLine: 1,
        ordered: 6,
        received: 4,
        unitCost: 1620.0,
        lotN: 730,
      },
    ],
  }),

  // ─── PO-2024-00420 (V-10330, DET-MFG) — full both lines ──────
  receipt({
    num: 'REC-2024-01310',
    po: 'PO-2024-00420',
    vendor: 'V-10330',
    date: '2024-11-24',
    plant: 'DET-MFG',
    lines: [
      {
        partNum: 'PKG-COR-48x40',
        partDesc: 'Corrugated Cardboard Sheets 48"x40"',
        poLine: 1,
        ordered: 5000,
        received: 5000,
        unitCost: 2.85,
        lotN: 750,
      },
      {
        partNum: 'PKG-STR-20K',
        partDesc: "Plastic Stretch Wrap 20\" x 1500'",
        poLine: 2,
        ordered: 60,
        received: 60,
        unitCost: 95.0,
        lotN: 751,
      },
    ],
  }),

  // ─── PO-2024-00421 (V-10331, CHI-MFG) — slight over ──────────
  receipt({
    num: 'REC-2024-01325',
    po: 'PO-2024-00421',
    vendor: 'V-10331',
    date: '2024-11-29',
    plant: 'CHI-MFG',
    lines: [
      {
        partNum: 'PKG-PALLETS-48',
        partDesc: 'Wooden Pallets 48"x40"',
        poLine: 1,
        ordered: 1200,
        received: 1224, // exactly 2% over
        unitCost: 24.5,
        lotN: 770,
      },
    ],
  }),

  // ─── PO-2024-00422 (V-10332, CLE-MFG) — multi-receipt partial ─
  receipt({
    num: 'REC-2024-01340',
    po: 'PO-2024-00422',
    vendor: 'V-10332',
    date: '2024-12-04',
    plant: 'CLE-MFG',
    lines: [
      {
        partNum: 'PKG-RTNB-LRG',
        partDesc: 'Returnable Steel Container - Large',
        poLine: 1,
        ordered: 50,
        received: 25,
        unitCost: 480.0,
        lotN: 800,
      },
    ],
  }),
  receipt({
    num: 'REC-2024-01345',
    po: 'PO-2024-00422',
    vendor: 'V-10332',
    date: '2024-12-18',
    plant: 'CLE-MFG',
    lines: [
      {
        partNum: 'PKG-RTNB-MED',
        partDesc: 'Returnable Steel Container - Medium',
        poLine: 2,
        ordered: 80,
        received: 40,
        unitCost: 320.0,
        lotN: 815,
      },
    ],
  }),

  // ─── PO-2024-00500 (V-10501, DET-MFG) — 3-line, partial mix ──
  receipt({
    num: 'REC-2024-01410',
    po: 'PO-2024-00500',
    vendor: 'V-10501',
    date: '2024-11-25',
    plant: 'DET-MFG',
    lines: [
      {
        partNum: 'MRO-FAS-M8x35',
        partDesc: 'Hex Bolt M8 x 35mm Class 10.9',
        poLine: 1,
        ordered: 5000,
        received: 5000,
        unitCost: 0.42,
        lotN: 821,
      },
      {
        partNum: 'MRO-FAS-M10x40',
        partDesc: 'Hex Bolt M10 x 40mm Class 10.9',
        poLine: 2,
        ordered: 4000,
        received: 4000,
        unitCost: 0.78,
        lotN: 822,
      },
      {
        partNum: 'MRO-FAS-NUT-M8',
        partDesc: 'Hex Nut M8 Class 10',
        poLine: 3,
        ordered: 5000,
        received: 4800,
        unitCost: 0.18,
        lotN: 823,
      },
    ],
  }),

  // ─── PO-2024-00501 (V-10502, CHI-MFG) — fully received ───────
  receipt({
    num: 'REC-2024-01435',
    po: 'PO-2024-00501',
    vendor: 'V-10502',
    date: '2024-11-26',
    plant: 'CHI-MFG',
    lines: [
      {
        partNum: 'MRO-CUT-INS-CRB',
        partDesc: 'Carbide Cutting Insert - Square',
        poLine: 1,
        ordered: 200,
        received: 200,
        unitCost: 18.5,
        lotN: 845,
      },
    ],
  }),

  // ─── PO-2024-00502 (V-10503, CLE-MFG) — full + over ──────────
  receipt({
    num: 'REC-2024-01450',
    po: 'PO-2024-00502',
    vendor: 'V-10503',
    date: '2024-11-28',
    plant: 'CLE-MFG',
    lines: [
      {
        partNum: 'MRO-BLD-BAND-1.5',
        partDesc: 'Band Saw Blade 1.5" Bi-Metal',
        poLine: 1,
        ordered: 12,
        received: 12,
        unitCost: 142.0,
        lotN: 870,
      },
      {
        partNum: 'MRO-LBR-WAY-1G',
        partDesc: 'Way Lubricant 1 Gallon',
        poLine: 2,
        ordered: 24,
        received: 24,
        unitCost: 38.0,
        lotN: 871,
      },
    ],
  }),

  // ─── PO-2024-00503 (V-10504, DET-MFG) — fully received ───────
  receipt({
    num: 'REC-2024-01465',
    po: 'PO-2024-00503',
    vendor: 'V-10504',
    date: '2024-11-29',
    plant: 'DET-MFG',
    lines: [
      {
        partNum: 'MRO-TOOL-HEX-MET',
        partDesc: 'Hex Key Metric Set 1.5-10mm',
        poLine: 1,
        ordered: 8,
        received: 8,
        unitCost: 24.5,
        lotN: 880,
      },
    ],
  }),

  // ─── PO-2024-00601 (V-10605, DET-MFG) — full ─────────────────
  receipt({
    num: 'REC-2024-01510',
    po: 'PO-2024-00601',
    vendor: 'V-10605',
    date: '2024-11-22',
    plant: 'DET-MFG',
    lines: [
      {
        partNum: 'FK-FORK-1500',
        partDesc: 'Forklift Fork Pair 1500mm Class III',
        poLine: 1,
        ordered: 2,
        received: 2,
        unitCost: 2200.0,
        lotN: 901,
      },
      {
        partNum: 'FK-WHL-PU-300',
        partDesc: 'Polyurethane Drive Wheel 300mm',
        poLine: 2,
        ordered: 4,
        received: 4,
        unitCost: 295.0,
        lotN: 902,
      },
    ],
  }),

  // ─── PO-2024-00602 (V-10606, CHI-MFG) — 3 lines, full ────────
  receipt({
    num: 'REC-2024-01525',
    po: 'PO-2024-00602',
    vendor: 'V-10606',
    date: '2024-11-25',
    plant: 'CHI-MFG',
    lines: [
      {
        partNum: 'PPE-GLOVE-CUT-A4',
        partDesc: 'ANSI Cut Level A4 Gloves Size L',
        poLine: 1,
        ordered: 240,
        received: 240,
        unitCost: 7.45,
        lotN: 925,
      },
      {
        partNum: 'PPE-GLASS-CLR',
        partDesc: 'Safety Glasses Clear Anti-Fog',
        poLine: 2,
        ordered: 480,
        received: 480,
        unitCost: 4.2,
        lotN: 926,
      },
      {
        partNum: 'PPE-EAR-PLG-NRR33',
        partDesc: 'Earplugs NRR 33 Foam',
        poLine: 3,
        ordered: 5000,
        received: 5050, // 1% over
        unitCost: 0.32,
        lotN: 927,
      },
    ],
  }),

  // ─── PO-2024-00701 (V-10721, DET-MFG) — full freight ─────────
  receipt({
    num: 'REC-2024-01580',
    po: 'PO-2024-00701',
    vendor: 'V-10721',
    date: '2024-11-30',
    plant: 'DET-MFG',
    lines: [
      {
        partNum: 'FRT-LCL-DET-CHI',
        partDesc: 'LTL Freight Detroit→Chicago (Nov)',
        poLine: 1,
        ordered: 1,
        received: 1,
        unitCost: 6800.0,
        lotN: 950,
      },
    ],
  }),

  // ─── PO-2024-00800 / 00801 (small POs, fully received) ───────
  receipt({
    num: 'REC-2024-01620',
    po: 'PO-2024-00800',
    vendor: 'V-10501',
    date: '2024-11-25',
    plant: 'DET-MFG',
    lines: [
      {
        partNum: 'MRO-TAPE-DUCT',
        partDesc: 'Duct Tape 2" x 60yd',
        poLine: 1,
        ordered: 24,
        received: 24,
        unitCost: 8.5,
        lotN: 970,
      },
    ],
  }),
  receipt({
    num: 'REC-2024-01622',
    po: 'PO-2024-00801',
    vendor: 'V-10502',
    date: '2024-11-25',
    plant: 'CHI-MFG',
    lines: [
      {
        partNum: 'MRO-DRILL-1/4',
        partDesc: 'Drill Bit 1/4" HSS',
        poLine: 1,
        ordered: 25,
        received: 25,
        unitCost: 9.8,
        lotN: 971,
      },
    ],
  }),

  // ─── PO-2024-00910 (V-10501, DET-MFG) — 5-line giant receipt ──
  receipt({
    num: 'REC-2024-01680',
    po: 'PO-2024-00910',
    vendor: 'V-10501',
    date: '2024-11-21',
    plant: 'DET-MFG',
    lines: [
      {
        partNum: 'MRO-OIL-WAY-5G',
        partDesc: 'Way Oil 5 Gallon Pail',
        poLine: 1,
        ordered: 10,
        received: 10,
        unitCost: 165.0,
        lotN: 1001,
      },
      {
        partNum: 'MRO-RAG-SHOP-50',
        partDesc: 'Shop Rags 50/pack',
        poLine: 2,
        ordered: 24,
        received: 24,
        unitCost: 22.5,
        lotN: 1002,
      },
      {
        partNum: 'MRO-WD40-12',
        partDesc: 'WD-40 12oz Aerosol',
        poLine: 3,
        ordered: 144,
        received: 144,
        unitCost: 6.45,
        lotN: 1003,
      },
      {
        partNum: 'MRO-BRK-CLN-15',
        partDesc: 'Brake Cleaner 15oz Aerosol',
        poLine: 4,
        ordered: 96,
        received: 96,
        unitCost: 5.95,
        lotN: 1004,
      },
      {
        partNum: 'MRO-NITRILE-BX',
        partDesc: 'Nitrile Gloves Box of 100 (Large)',
        poLine: 5,
        ordered: 60,
        received: 60,
        unitCost: 14.95,
        lotN: 1005,
      },
    ],
  }),

  // ─── PO-2024-01000 (steel, multi receipt, partial) ───────────
  receipt({
    num: 'REC-2024-01710',
    po: 'PO-2024-01000',
    vendor: 'V-10042',
    date: '2024-12-04',
    plant: 'DET-MFG',
    lines: [
      {
        partNum: 'STL-CL-HR-080',
        partDesc: 'Hot Rolled Steel Coil 0.080"',
        poLine: 1,
        ordered: 35,
        received: 18,
        unitCost: 870.0,
        lotN: 1100,
      },
    ],
  }),
  receipt({
    num: 'REC-2024-01715',
    po: 'PO-2024-01000',
    vendor: 'V-10042',
    date: '2024-12-09',
    plant: 'DET-MFG',
    lines: [
      {
        partNum: 'STL-CL-HR-080',
        partDesc: 'Hot Rolled Steel Coil 0.080"',
        poLine: 1,
        ordered: 35,
        received: 17,
        unitCost: 870.0,
        lotN: 1115,
      },
    ],
  }),

  // ─── PO-2024-01002 (V-10330, packaging, partial → over) ──────
  receipt({
    num: 'REC-2024-01730',
    po: 'PO-2024-01002',
    vendor: 'V-10330',
    date: '2024-12-09',
    plant: 'CLE-MFG',
    lines: [
      {
        partNum: 'PKG-FOAM-ESD',
        partDesc: 'ESD Foam Sheets 24"x36"',
        poLine: 1,
        ordered: 800,
        received: 400,
        unitCost: 3.65,
        lotN: 1130,
      },
    ],
  }),
  receipt({
    num: 'REC-2024-01735',
    po: 'PO-2024-01002',
    vendor: 'V-10330',
    date: '2024-12-12',
    plant: 'CLE-MFG',
    lines: [
      {
        partNum: 'PKG-FOAM-ESD',
        partDesc: 'ESD Foam Sheets 24"x36"',
        poLine: 1,
        ordered: 800,
        received: 410, // slight over (1.25% over)
        unitCost: 3.65,
        lotN: 1141,
      },
    ],
  }),

  // ─── PO-2024-01003 (V-10211, lubricants, fully received) ─────
  receipt({
    num: 'REC-2024-01755',
    po: 'PO-2024-01003',
    vendor: 'V-10211',
    date: '2024-12-13',
    plant: 'DET-MFG',
    lines: [
      {
        partNum: 'LUB-COOL-ML-55',
        partDesc: 'Coolant Concentrate Metalworking',
        poLine: 1,
        ordered: 18,
        received: 18,
        unitCost: 1380.0,
        lotN: 1160,
      },
      {
        partNum: 'LUB-FILT-COOL',
        partDesc: 'Coolant Filter Element',
        poLine: 2,
        ordered: 60,
        received: 60,
        unitCost: 38.5,
        lotN: 1161,
      },
    ],
  }),

  // ─── Closed PO receipts (historical, fully received) ─────────
  receipt({
    num: 'REC-2024-00500',
    po: 'PO-2024-00050',
    vendor: 'V-10042',
    date: '2024-09-22',
    plant: 'DET-MFG',
    lines: [
      {
        partNum: 'STL-CL-HR-050',
        partDesc: 'Hot Rolled Steel Coil 0.050" (Sept lot)',
        poLine: 1,
        ordered: 20,
        received: 20,
        unitCost: 880.0,
        lotN: 220,
      },
    ],
  }),
  receipt({
    num: 'REC-2024-00510',
    po: 'PO-2024-00051',
    vendor: 'V-10043',
    date: '2024-09-26',
    plant: 'CHI-MFG',
    lines: [
      {
        partNum: 'STL-CL-CR-040',
        partDesc: 'Cold Rolled Steel Coil 0.040" (Sept lot)',
        poLine: 1,
        ordered: 28,
        received: 28,
        unitCost: 925.0,
        lotN: 230,
      },
    ],
  }),
  receipt({
    num: 'REC-2024-00525',
    po: 'PO-2024-00052',
    vendor: 'V-10211',
    date: '2024-09-28',
    plant: 'CLE-MFG',
    lines: [
      {
        partNum: 'LUB-DRAW-HD-55',
        partDesc: 'Heavy-Duty Drawing Lubricant (Q3)',
        poLine: 1,
        ordered: 8,
        received: 8,
        unitCost: 1820.0,
        lotN: 240,
      },
    ],
  }),
  receipt({
    num: 'REC-2024-00540',
    po: 'PO-2024-00053',
    vendor: 'V-10501',
    date: '2024-09-24',
    plant: 'DET-MFG',
    lines: [
      {
        partNum: 'MRO-FAS-M8x35',
        partDesc: 'Hex Bolt M8 x 35mm (Q3 stock)',
        poLine: 1,
        ordered: 4000,
        received: 4000,
        unitCost: 0.4,
        lotN: 250,
      },
    ],
  }),
  receipt({
    num: 'REC-2024-00555',
    po: 'PO-2024-00054',
    vendor: 'V-10330',
    date: '2024-10-04',
    plant: 'CHI-MFG',
    lines: [
      {
        partNum: 'PKG-COR-48x40',
        partDesc: 'Corrugated Cardboard Sheets 48"x40" (Q3)',
        poLine: 1,
        ordered: 4000,
        received: 4000,
        unitCost: 2.75,
        lotN: 260,
      },
    ],
  }),
  receipt({
    num: 'REC-2024-00570',
    po: 'PO-2024-00055',
    vendor: 'V-10721',
    date: '2024-10-12',
    plant: 'CLE-MFG',
    lines: [
      {
        partNum: 'FRT-LCL-CLE-DET',
        partDesc: 'LTL Freight Cleveland→Detroit (Sept)',
        poLine: 1,
        ordered: 1,
        received: 1,
        unitCost: 5400.0,
        lotN: 270,
      },
    ],
  }),
  receipt({
    num: 'REC-2024-00585',
    po: 'PO-2024-00056',
    vendor: 'V-10502',
    date: '2024-10-04',
    plant: 'DET-MFG',
    lines: [
      {
        partNum: 'MRO-CUT-INS-CRB',
        partDesc: 'Carbide Cutting Insert (Q3 stock)',
        poLine: 1,
        ordered: 150,
        received: 153, // 2% over
        unitCost: 18.0,
        lotN: 280,
      },
    ],
  }),
  receipt({
    num: 'REC-2024-00601',
    po: 'PO-2024-00057',
    vendor: 'V-10092',
    date: '2024-10-11',
    plant: 'CHI-MFG',
    lines: [
      {
        partNum: 'TOOL-PUN-SET-15',
        partDesc: 'Punch Set 15-Piece Carbide (Q3)',
        poLine: 1,
        ordered: 3,
        received: 3,
        unitCost: 3380.0,
        lotN: 290,
      },
    ],
  }),
  receipt({
    num: 'REC-2024-00615',
    po: 'PO-2024-00058',
    vendor: 'V-10212',
    date: '2024-10-11',
    plant: 'CLE-MFG',
    lines: [
      {
        partNum: 'CHM-CL-DEGREASE',
        partDesc: 'Industrial Degreaser (Q3)',
        poLine: 1,
        ordered: 24,
        received: 24,
        unitCost: 142.0,
        lotN: 300,
      },
    ],
  }),
  receipt({
    num: 'REC-2024-00630',
    po: 'PO-2024-00059',
    vendor: 'V-10046',
    date: '2024-09-30',
    plant: 'DET-MFG',
    lines: [
      {
        partNum: 'AL-CL-5052-050',
        partDesc: 'Aluminum 5052 Coil 0.050" (Q3)',
        poLine: 1,
        ordered: 12,
        received: 12,
        unitCost: 2350.0,
        lotN: 310,
      },
    ],
  }),

  // ─── Additional partial / multi-receipt entries to reach 60 ──
  receipt({
    num: 'REC-2024-01810',
    po: 'PO-2024-00210',
    vendor: 'V-10089',
    date: '2025-01-30',
    plant: 'DET-MFG',
    lines: [
      {
        partNum: 'DIE-PRG-2024-A',
        partDesc: 'Progressive Die Tooling - Rail Bracket',
        poLine: 1,
        ordered: 1,
        received: 1,
        unitCost: 145000.0,
        lotN: 1200,
      },
    ],
  }),
  receipt({
    num: 'REC-2024-01825',
    po: 'PO-2024-00213',
    vendor: 'V-10093',
    date: '2024-12-12',
    plant: 'CLE-MFG',
    lines: [
      {
        partNum: 'DIE-TRM-FRM-A',
        partDesc: 'Trim/Form Die Cold-Stamping',
        poLine: 1,
        ordered: 1,
        received: 1,
        unitCost: 92000.0,
        lotN: 1215,
      },
    ],
  }),
  receipt({
    num: 'REC-2024-01840',
    po: 'PO-2024-00501',
    vendor: 'V-10502',
    date: '2024-12-02',
    plant: 'CHI-MFG',
    lines: [
      {
        partNum: 'MRO-CUT-INS-CRB',
        partDesc: 'Carbide Cutting Insert - Square (top-up)',
        poLine: 1,
        ordered: 200,
        received: 24,
        unitCost: 18.5,
        lotN: 1230,
      },
    ],
  }),
  receipt({
    num: 'REC-2024-01855',
    po: 'PO-2024-00500',
    vendor: 'V-10501',
    date: '2024-11-28',
    plant: 'DET-MFG',
    lines: [
      {
        partNum: 'MRO-FAS-NUT-M8',
        partDesc: 'Hex Nut M8 Class 10 (top-up)',
        poLine: 3,
        ordered: 5000,
        received: 200,
        unitCost: 0.18,
        lotN: 1245,
      },
    ],
  }),
  receipt({
    num: 'REC-2024-01870',
    po: 'PO-2024-00351',
    vendor: 'V-10212',
    date: '2024-11-29',
    plant: 'CHI-MFG',
    lines: [
      {
        partNum: 'CHM-CL-DEGREASE',
        partDesc: 'Industrial Degreaser Concentrate (top-up)',
        poLine: 1,
        ordered: 30,
        received: 1, // tiny add
        unitCost: 145.0,
        lotN: 1260,
      },
    ],
  }),
  receipt({
    num: 'REC-2024-01885',
    po: 'PO-2024-00146',
    vendor: 'V-10046',
    date: '2024-12-19',
    plant: 'DET-MFG',
    lines: [
      {
        partNum: 'AL-CL-5052-050',
        partDesc: 'Aluminum 5052 Coil 0.050"',
        poLine: 1,
        ordered: 18,
        received: 6,
        unitCost: 2400.0,
        lotN: 1275,
      },
      {
        partNum: 'AL-CL-6061-060',
        partDesc: 'Aluminum 6061 Coil 0.060"',
        poLine: 2,
        ordered: 22,
        received: 7,
        unitCost: 2580.0,
        lotN: 1276,
      },
    ],
  }),
  receipt({
    num: 'REC-2024-01900',
    po: 'PO-2024-00145',
    vendor: 'V-10045',
    date: '2024-12-15',
    plant: 'CLE-MFG',
    lines: [
      {
        partNum: 'STL-SS-304-035',
        partDesc: 'Stainless 304 Sheet 0.035" (top-up)',
        poLine: 1,
        ordered: 8000,
        received: 50, // top-up over (well within 2%)
        unitCost: 4.25,
        lotN: 1290,
      },
    ],
  }),
  receipt({
    num: 'REC-2024-01915',
    po: 'PO-2024-00211',
    vendor: 'V-10091',
    date: '2025-01-15',
    plant: 'DET-MFG',
    lines: [
      {
        partNum: 'FIX-WLD-CRSH-A',
        partDesc: 'Crash Beam Welding Fixture (spare parts)',
        poLine: 1,
        ordered: 1,
        received: 0,
        unitCost: 78500.0,
        lotN: 1305,
      },
    ],
  }),
  receipt({
    num: 'REC-2024-01930',
    po: 'PO-2024-00420',
    vendor: 'V-10330',
    date: '2024-11-28',
    plant: 'DET-MFG',
    lines: [
      {
        partNum: 'PKG-COR-48x40',
        partDesc: 'Corrugated Cardboard (extra)',
        poLine: 1,
        ordered: 5000,
        received: 75,
        unitCost: 2.85,
        lotN: 1320,
      },
    ],
  }),
  receipt({
    num: 'REC-2024-01945',
    po: 'PO-2024-00422',
    vendor: 'V-10332',
    date: '2024-12-22',
    plant: 'CLE-MFG',
    lines: [
      {
        partNum: 'PKG-RTNB-LRG',
        partDesc: 'Returnable Steel Container - Large',
        poLine: 1,
        ordered: 50,
        received: 25,
        unitCost: 480.0,
        lotN: 1335,
      },
      {
        partNum: 'PKG-RTNB-MED',
        partDesc: 'Returnable Steel Container - Medium',
        poLine: 2,
        ordered: 80,
        received: 40,
        unitCost: 320.0,
        lotN: 1336,
      },
    ],
  }),
  receipt({
    num: 'REC-2024-01960',
    po: 'PO-2024-00351',
    vendor: 'V-10212',
    date: '2024-11-23',
    plant: 'CHI-MFG',
    lines: [
      {
        partNum: 'CHM-CL-RUSTGUARD',
        partDesc: 'Anti-Corrosion Rust Inhibitor (top-up)',
        poLine: 2,
        ordered: 8,
        received: 1, // 12.5% over
        unitCost: 920.0,
        lotN: 1350,
      },
    ],
  }),
  receipt({
    num: 'REC-2024-01975',
    po: 'PO-2024-00211',
    vendor: 'V-10091',
    date: '2025-02-01',
    plant: 'DET-MFG',
    lines: [
      {
        partNum: 'FIX-WLD-CRSH-B',
        partDesc: 'Crash Beam Welding Fixture (RH variant - QA hold)',
        poLine: 2,
        ordered: 1,
        received: 0,
        unitCost: 78500.0,
        lotN: 1365,
      },
    ],
  }),
  receipt({
    num: 'REC-2024-01990',
    po: 'PO-2024-00500',
    vendor: 'V-10501',
    date: '2024-12-05',
    plant: 'DET-MFG',
    lines: [
      {
        partNum: 'MRO-FAS-M8x35',
        partDesc: 'Hex Bolt M8 x 35mm Class 10.9 (top-up)',
        poLine: 1,
        ordered: 5000,
        received: 80,
        unitCost: 0.42,
        lotN: 1380,
      },
    ],
  }),
  receipt({
    num: 'REC-2024-02005',
    po: 'PO-2024-00500',
    vendor: 'V-10501',
    date: '2024-12-09',
    plant: 'DET-MFG',
    lines: [
      {
        partNum: 'MRO-FAS-NUT-M8',
        partDesc: 'Hex Nut M8 Class 10 (final top-up)',
        poLine: 3,
        ordered: 5000,
        received: 50,
        unitCost: 0.18,
        lotN: 1395,
      },
    ],
  }),
  receipt({
    num: 'REC-2024-02020',
    po: 'PO-2024-00910',
    vendor: 'V-10501',
    date: '2024-11-23',
    plant: 'DET-MFG',
    lines: [
      {
        partNum: 'MRO-WD40-12',
        partDesc: 'WD-40 12oz Aerosol (top-up)',
        poLine: 3,
        ordered: 144,
        received: 6,
        unitCost: 6.45,
        lotN: 1410,
      },
    ],
  }),
];

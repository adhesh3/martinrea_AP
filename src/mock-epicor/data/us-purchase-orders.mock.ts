/**
 * Mock US Epicor Purchase Order rows (header + lines).
 *
 * Mix:
 *   - 40 total POs
 *   - 30 OpenOrder=true (still receivable / invoiceable)
 *   - 10 OpenOrder=false (closed — to test sync filtering)
 *
 * Variety:
 *   - 1, 2, 3, 4, 5 line items
 *   - Plants: DET-MFG, CHI-MFG, CLE-MFG
 *   - Amounts: small (~$500) → very large (~$180K)
 *   - UOMs: TON, LB, EA, GAL, DRM
 *   - Vendors mixed across `US_SUPPLIERS`
 */

export interface USPurchaseOrderLine {
  LineNum: number;
  PartNum: string;
  LineDesc: string;
  OrderQty: number;
  UOM: 'EA' | 'LB' | 'TON' | 'GAL' | 'DRM' | 'BOX';
  UnitCost: number;
  ExtCost: number;
  OpenLine: boolean;
}

export interface USPurchaseOrderRecord {
  PONum: string;
  VendorNum: string;
  OrderDate: string;
  NeedByDate: string;
  OpenOrder: boolean;
  BuyerID: string;
  CurrencyCode: 'USD';
  TotalOrderAmt: number;
  Plant: 'DET-MFG' | 'CHI-MFG' | 'CLE-MFG';
  Lines: USPurchaseOrderLine[];
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

function makePO(args: {
  num: string;
  vendor: string;
  orderDate: string;
  needByDate: string;
  open: boolean;
  buyer?: string;
  plant: USPurchaseOrderRecord['Plant'];
  lines: Array<Omit<USPurchaseOrderLine, 'ExtCost' | 'OpenLine' | 'LineNum'> & {
    LineNum?: number;
    OpenLine?: boolean;
  }>;
}): USPurchaseOrderRecord {
  const Lines: USPurchaseOrderLine[] = args.lines.map((l, i) => ({
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
    BuyerID: args.buyer ?? 'BUYER01',
    CurrencyCode: 'USD',
    TotalOrderAmt: round2(Lines.reduce((acc, l) => acc + l.ExtCost, 0)),
    Plant: args.plant,
    Lines,
  };
}

export const US_PURCHASE_ORDERS: USPurchaseOrderRecord[] = [
  // ─── Steel coil POs (large $$$) ───────────────────────────────
  makePO({
    num: 'PO-2024-00142',
    vendor: 'V-10042',
    orderDate: '2024-11-15',
    needByDate: '2024-12-01',
    open: true,
    plant: 'DET-MFG',
    lines: [
      {
        PartNum: 'STL-CL-HR-050',
        LineDesc: 'Hot Rolled Steel Coil 0.050" Gauge',
        OrderQty: 25,
        UOM: 'TON',
        UnitCost: 875.0,
      },
      {
        PartNum: 'STL-CL-HR-065',
        LineDesc: 'Hot Rolled Steel Coil 0.065" Gauge',
        OrderQty: 30,
        UOM: 'TON',
        UnitCost: 860.0,
      },
    ],
  }),
  makePO({
    num: 'PO-2024-00143',
    vendor: 'V-10043',
    orderDate: '2024-11-18',
    needByDate: '2024-12-05',
    open: true,
    plant: 'CHI-MFG',
    lines: [
      {
        PartNum: 'STL-CL-CR-040',
        LineDesc: 'Cold Rolled Steel Coil 0.040" Gauge',
        OrderQty: 40,
        UOM: 'TON',
        UnitCost: 935.0,
      },
    ],
  }),
  makePO({
    num: 'PO-2024-00144',
    vendor: 'V-10044',
    orderDate: '2024-11-20',
    needByDate: '2024-12-10',
    open: true,
    plant: 'CLE-MFG',
    buyer: 'BUYER02',
    lines: [
      {
        PartNum: 'STL-CL-HSLA-060',
        LineDesc: 'HSLA Steel Coil 0.060" Gauge',
        OrderQty: 60,
        UOM: 'TON',
        UnitCost: 1100.0,
      },
      {
        PartNum: 'STL-CL-HSLA-080',
        LineDesc: 'HSLA Steel Coil 0.080" Gauge',
        OrderQty: 50,
        UOM: 'TON',
        UnitCost: 1180.0,
      },
      {
        PartNum: 'STL-CL-HSLA-100',
        LineDesc: 'HSLA Steel Coil 0.100" Gauge',
        OrderQty: 50,
        UOM: 'TON',
        UnitCost: 1250.0,
      },
    ],
  }),
  makePO({
    num: 'PO-2024-00145',
    vendor: 'V-10045',
    orderDate: '2024-11-22',
    needByDate: '2024-12-12',
    open: true,
    plant: 'CLE-MFG',
    lines: [
      {
        PartNum: 'STL-SS-304-035',
        LineDesc: 'Stainless 304 Sheet 0.035"',
        OrderQty: 8000,
        UOM: 'LB',
        UnitCost: 4.25,
      },
    ],
  }),
  makePO({
    num: 'PO-2024-00146',
    vendor: 'V-10046',
    orderDate: '2024-11-25',
    needByDate: '2024-12-15',
    open: true,
    plant: 'DET-MFG',
    lines: [
      {
        PartNum: 'AL-CL-5052-050',
        LineDesc: 'Aluminum 5052 Coil 0.050"',
        OrderQty: 18,
        UOM: 'TON',
        UnitCost: 2400.0,
      },
      {
        PartNum: 'AL-CL-6061-060',
        LineDesc: 'Aluminum 6061 Coil 0.060"',
        OrderQty: 22,
        UOM: 'TON',
        UnitCost: 2580.0,
      },
    ],
  }),

  // ─── Tooling & die POs (medium-large $$$, multi-line) ─────────
  makePO({
    num: 'PO-2024-00210',
    vendor: 'V-10089',
    orderDate: '2024-10-10',
    needByDate: '2025-02-01',
    open: true,
    plant: 'DET-MFG',
    buyer: 'BUYER03',
    lines: [
      {
        PartNum: 'DIE-PRG-2024-A',
        LineDesc: 'Progressive Die Tooling - Rail Bracket',
        OrderQty: 1,
        UOM: 'EA',
        UnitCost: 145000.0,
      },
    ],
  }),
  makePO({
    num: 'PO-2024-00211',
    vendor: 'V-10091',
    orderDate: '2024-10-12',
    needByDate: '2025-01-15',
    open: true,
    plant: 'DET-MFG',
    buyer: 'BUYER03',
    lines: [
      {
        PartNum: 'FIX-WLD-CRSH-A',
        LineDesc: 'Crash Beam Welding Fixture',
        OrderQty: 1,
        UOM: 'EA',
        UnitCost: 78500.0,
      },
      {
        PartNum: 'FIX-WLD-CRSH-B',
        LineDesc: 'Crash Beam Welding Fixture (RH variant)',
        OrderQty: 1,
        UOM: 'EA',
        UnitCost: 78500.0,
      },
    ],
  }),
  makePO({
    num: 'PO-2024-00212',
    vendor: 'V-10092',
    orderDate: '2024-10-18',
    needByDate: '2024-12-20',
    open: true,
    plant: 'CHI-MFG',
    buyer: 'BUYER02',
    lines: [
      {
        PartNum: 'TOOL-PUN-SET-15',
        LineDesc: 'Punch Set 15-Piece Carbide',
        OrderQty: 4,
        UOM: 'EA',
        UnitCost: 3400.0,
      },
      {
        PartNum: 'TOOL-DIE-INS-30',
        LineDesc: 'Die Inserts 30mm Carbide (set of 6)',
        OrderQty: 6,
        UOM: 'EA',
        UnitCost: 1250.0,
      },
      {
        PartNum: 'TOOL-MNT-STR-50',
        LineDesc: 'Mounting Strap Hardware Kit',
        OrderQty: 25,
        UOM: 'EA',
        UnitCost: 78.0,
      },
    ],
  }),
  makePO({
    num: 'PO-2024-00213',
    vendor: 'V-10093',
    orderDate: '2024-09-25',
    needByDate: '2024-12-15',
    open: true,
    plant: 'CLE-MFG',
    lines: [
      {
        PartNum: 'DIE-TRM-FRM-A',
        LineDesc: 'Trim/Form Die Cold-Stamping',
        OrderQty: 1,
        UOM: 'EA',
        UnitCost: 92000.0,
      },
    ],
  }),

  // ─── Lubricants / chemicals (medium) ──────────────────────────
  makePO({
    num: 'PO-2024-00350',
    vendor: 'V-10211',
    orderDate: '2024-11-01',
    needByDate: '2024-11-20',
    open: true,
    plant: 'DET-MFG',
    lines: [
      {
        PartNum: 'LUB-DRAW-HD-55',
        LineDesc: 'Heavy-Duty Drawing Lubricant',
        OrderQty: 12,
        UOM: 'DRM',
        UnitCost: 1850.0,
      },
    ],
  }),
  makePO({
    num: 'PO-2024-00351',
    vendor: 'V-10212',
    orderDate: '2024-11-03',
    needByDate: '2024-11-22',
    open: true,
    plant: 'CHI-MFG',
    lines: [
      {
        PartNum: 'CHM-CL-DEGREASE',
        LineDesc: 'Industrial Degreaser Concentrate',
        OrderQty: 30,
        UOM: 'GAL',
        UnitCost: 145.0,
      },
      {
        PartNum: 'CHM-CL-RUSTGUARD',
        LineDesc: 'Anti-Corrosion Rust Inhibitor',
        OrderQty: 8,
        UOM: 'DRM',
        UnitCost: 920.0,
      },
    ],
  }),
  makePO({
    num: 'PO-2024-00352',
    vendor: 'V-10213',
    orderDate: '2024-11-08',
    needByDate: '2024-11-28',
    open: true,
    plant: 'CLE-MFG',
    lines: [
      {
        PartNum: 'LUB-PRESS-LIGHT',
        LineDesc: 'Light-Duty Press Lubricant',
        OrderQty: 6,
        UOM: 'DRM',
        UnitCost: 1620.0,
      },
    ],
  }),

  // ─── Packaging (small-medium) ─────────────────────────────────
  makePO({
    num: 'PO-2024-00420',
    vendor: 'V-10330',
    orderDate: '2024-11-10',
    needByDate: '2024-11-25',
    open: true,
    plant: 'DET-MFG',
    lines: [
      {
        PartNum: 'PKG-COR-48x40',
        LineDesc: 'Corrugated Cardboard Sheets 48"x40"',
        OrderQty: 5000,
        UOM: 'EA',
        UnitCost: 2.85,
      },
      {
        PartNum: 'PKG-STR-20K',
        LineDesc: 'Plastic Stretch Wrap 20" x 1500\'',
        OrderQty: 60,
        UOM: 'BOX',
        UnitCost: 95.0,
      },
    ],
  }),
  makePO({
    num: 'PO-2024-00421',
    vendor: 'V-10331',
    orderDate: '2024-11-12',
    needByDate: '2024-11-30',
    open: true,
    plant: 'CHI-MFG',
    lines: [
      {
        PartNum: 'PKG-PALLETS-48',
        LineDesc: 'Wooden Pallets 48"x40"',
        OrderQty: 1200,
        UOM: 'EA',
        UnitCost: 24.5,
      },
    ],
  }),
  makePO({
    num: 'PO-2024-00422',
    vendor: 'V-10332',
    orderDate: '2024-11-14',
    needByDate: '2025-01-05',
    open: true,
    plant: 'CLE-MFG',
    lines: [
      {
        PartNum: 'PKG-RTNB-LRG',
        LineDesc: 'Returnable Steel Container - Large',
        OrderQty: 50,
        UOM: 'EA',
        UnitCost: 480.0,
      },
      {
        PartNum: 'PKG-RTNB-MED',
        LineDesc: 'Returnable Steel Container - Medium',
        OrderQty: 80,
        UOM: 'EA',
        UnitCost: 320.0,
      },
    ],
  }),

  // ─── MRO (small-medium, often multi-line) ─────────────────────
  makePO({
    num: 'PO-2024-00500',
    vendor: 'V-10501',
    orderDate: '2024-11-19',
    needByDate: '2024-11-26',
    open: true,
    plant: 'DET-MFG',
    lines: [
      {
        PartNum: 'MRO-FAS-M8x35',
        LineDesc: 'Hex Bolt M8 x 35mm Class 10.9',
        OrderQty: 5000,
        UOM: 'EA',
        UnitCost: 0.42,
      },
      {
        PartNum: 'MRO-FAS-M10x40',
        LineDesc: 'Hex Bolt M10 x 40mm Class 10.9',
        OrderQty: 4000,
        UOM: 'EA',
        UnitCost: 0.78,
      },
      {
        PartNum: 'MRO-FAS-NUT-M8',
        LineDesc: 'Hex Nut M8 Class 10',
        OrderQty: 5000,
        UOM: 'EA',
        UnitCost: 0.18,
      },
    ],
  }),
  makePO({
    num: 'PO-2024-00501',
    vendor: 'V-10502',
    orderDate: '2024-11-20',
    needByDate: '2024-11-27',
    open: true,
    plant: 'CHI-MFG',
    lines: [
      {
        PartNum: 'MRO-CUT-INS-CRB',
        LineDesc: 'Carbide Cutting Insert - Square',
        OrderQty: 200,
        UOM: 'EA',
        UnitCost: 18.5,
      },
    ],
  }),
  makePO({
    num: 'PO-2024-00502',
    vendor: 'V-10503',
    orderDate: '2024-11-21',
    needByDate: '2024-11-29',
    open: true,
    plant: 'CLE-MFG',
    lines: [
      {
        PartNum: 'MRO-BLD-BAND-1.5',
        LineDesc: 'Band Saw Blade 1.5" Bi-Metal',
        OrderQty: 12,
        UOM: 'EA',
        UnitCost: 142.0,
      },
      {
        PartNum: 'MRO-LBR-WAY-1G',
        LineDesc: 'Way Lubricant 1 Gallon',
        OrderQty: 24,
        UOM: 'GAL',
        UnitCost: 38.0,
      },
    ],
  }),
  makePO({
    num: 'PO-2024-00503',
    vendor: 'V-10504',
    orderDate: '2024-11-22',
    needByDate: '2024-11-30',
    open: true,
    plant: 'DET-MFG',
    lines: [
      {
        PartNum: 'MRO-TOOL-HEX-MET',
        LineDesc: 'Hex Key Metric Set 1.5-10mm',
        OrderQty: 8,
        UOM: 'EA',
        UnitCost: 24.5,
      },
    ],
  }),

  // ─── Forklift parts / safety (small) ──────────────────────────
  makePO({
    num: 'PO-2024-00601',
    vendor: 'V-10605',
    orderDate: '2024-11-09',
    needByDate: '2024-11-23',
    open: true,
    plant: 'DET-MFG',
    lines: [
      {
        PartNum: 'FK-FORK-1500',
        LineDesc: 'Forklift Fork Pair 1500mm Class III',
        OrderQty: 2,
        UOM: 'EA',
        UnitCost: 2200.0,
      },
      {
        PartNum: 'FK-WHL-PU-300',
        LineDesc: 'Polyurethane Drive Wheel 300mm',
        OrderQty: 4,
        UOM: 'EA',
        UnitCost: 295.0,
      },
    ],
  }),
  makePO({
    num: 'PO-2024-00602',
    vendor: 'V-10606',
    orderDate: '2024-11-11',
    needByDate: '2024-11-25',
    open: true,
    plant: 'CHI-MFG',
    lines: [
      {
        PartNum: 'PPE-GLOVE-CUT-A4',
        LineDesc: 'ANSI Cut Level A4 Gloves Size L',
        OrderQty: 240,
        UOM: 'EA',
        UnitCost: 7.45,
      },
      {
        PartNum: 'PPE-GLASS-CLR',
        LineDesc: 'Safety Glasses Clear Anti-Fog',
        OrderQty: 480,
        UOM: 'EA',
        UnitCost: 4.2,
      },
      {
        PartNum: 'PPE-EAR-PLG-NRR33',
        LineDesc: 'Earplugs NRR 33 Foam',
        OrderQty: 5000,
        UOM: 'EA',
        UnitCost: 0.32,
      },
    ],
  }),

  // ─── Freight (small, single line) ─────────────────────────────
  makePO({
    num: 'PO-2024-00701',
    vendor: 'V-10721',
    orderDate: '2024-11-15',
    needByDate: '2024-11-30',
    open: true,
    plant: 'DET-MFG',
    lines: [
      {
        PartNum: 'FRT-LCL-DET-CHI',
        LineDesc: 'LTL Freight Detroit→Chicago (Nov)',
        OrderQty: 1,
        UOM: 'EA',
        UnitCost: 6800.0,
      },
    ],
  }),

  // ─── Single-line tiny POs (test small amounts) ────────────────
  makePO({
    num: 'PO-2024-00800',
    vendor: 'V-10501',
    orderDate: '2024-11-23',
    needByDate: '2024-11-26',
    open: true,
    plant: 'DET-MFG',
    lines: [
      {
        PartNum: 'MRO-TAPE-DUCT',
        LineDesc: 'Duct Tape 2" x 60yd',
        OrderQty: 24,
        UOM: 'EA',
        UnitCost: 8.5,
      },
    ],
  }),
  makePO({
    num: 'PO-2024-00801',
    vendor: 'V-10502',
    orderDate: '2024-11-23',
    needByDate: '2024-11-26',
    open: true,
    plant: 'CHI-MFG',
    lines: [
      {
        PartNum: 'MRO-DRILL-1/4',
        LineDesc: 'Drill Bit 1/4" HSS',
        OrderQty: 25,
        UOM: 'EA',
        UnitCost: 9.8,
      },
    ],
  }),

  // ─── Five-line PO (test multi-line normalisation) ─────────────
  makePO({
    num: 'PO-2024-00910',
    vendor: 'V-10501',
    orderDate: '2024-11-04',
    needByDate: '2024-11-22',
    open: true,
    plant: 'DET-MFG',
    lines: [
      {
        PartNum: 'MRO-OIL-WAY-5G',
        LineDesc: 'Way Oil 5 Gallon Pail',
        OrderQty: 10,
        UOM: 'EA',
        UnitCost: 165.0,
      },
      {
        PartNum: 'MRO-RAG-SHOP-50',
        LineDesc: 'Shop Rags 50/pack',
        OrderQty: 24,
        UOM: 'BOX',
        UnitCost: 22.5,
      },
      {
        PartNum: 'MRO-WD40-12',
        LineDesc: 'WD-40 12oz Aerosol',
        OrderQty: 144,
        UOM: 'EA',
        UnitCost: 6.45,
      },
      {
        PartNum: 'MRO-BRK-CLN-15',
        LineDesc: 'Brake Cleaner 15oz Aerosol',
        OrderQty: 96,
        UOM: 'EA',
        UnitCost: 5.95,
      },
      {
        PartNum: 'MRO-NITRILE-BX',
        LineDesc: 'Nitrile Gloves Box of 100 (Large)',
        OrderQty: 60,
        UOM: 'BOX',
        UnitCost: 14.95,
      },
    ],
  }),

  // ─── More open POs to fill out 30 ─────────────────────────────
  makePO({
    num: 'PO-2024-01000',
    vendor: 'V-10042',
    orderDate: '2024-11-26',
    needByDate: '2024-12-15',
    open: true,
    plant: 'DET-MFG',
    lines: [
      {
        PartNum: 'STL-CL-HR-080',
        LineDesc: 'Hot Rolled Steel Coil 0.080"',
        OrderQty: 35,
        UOM: 'TON',
        UnitCost: 870.0,
      },
    ],
  }),
  makePO({
    num: 'PO-2024-01001',
    vendor: 'V-10089',
    orderDate: '2024-11-27',
    needByDate: '2025-02-15',
    open: true,
    plant: 'CHI-MFG',
    buyer: 'BUYER03',
    lines: [
      {
        PartNum: 'DIE-PRG-2024-B',
        LineDesc: 'Progressive Die - Door Reinforcement',
        OrderQty: 1,
        UOM: 'EA',
        UnitCost: 178500.0,
      },
    ],
  }),
  makePO({
    num: 'PO-2024-01002',
    vendor: 'V-10330',
    orderDate: '2024-11-28',
    needByDate: '2024-12-12',
    open: true,
    plant: 'CLE-MFG',
    lines: [
      {
        PartNum: 'PKG-FOAM-ESD',
        LineDesc: 'ESD Foam Sheets 24"x36"',
        OrderQty: 800,
        UOM: 'EA',
        UnitCost: 3.65,
      },
    ],
  }),
  makePO({
    num: 'PO-2024-01003',
    vendor: 'V-10211',
    orderDate: '2024-11-29',
    needByDate: '2024-12-15',
    open: true,
    plant: 'DET-MFG',
    lines: [
      {
        PartNum: 'LUB-COOL-ML-55',
        LineDesc: 'Coolant Concentrate Metalworking',
        OrderQty: 18,
        UOM: 'DRM',
        UnitCost: 1380.0,
      },
      {
        PartNum: 'LUB-FILT-COOL',
        LineDesc: 'Coolant Filter Element',
        OrderQty: 60,
        UOM: 'EA',
        UnitCost: 38.5,
      },
    ],
  }),

  // ─── Closed POs (10) — must be filtered out by sync ───────────
  makePO({
    num: 'PO-2024-00050',
    vendor: 'V-10042',
    orderDate: '2024-09-10',
    needByDate: '2024-09-25',
    open: false,
    plant: 'DET-MFG',
    lines: [
      {
        PartNum: 'STL-CL-HR-050',
        LineDesc: 'Hot Rolled Steel Coil 0.050" (Sept lot)',
        OrderQty: 20,
        UOM: 'TON',
        UnitCost: 880.0,
      },
    ],
  }),
  makePO({
    num: 'PO-2024-00051',
    vendor: 'V-10043',
    orderDate: '2024-09-12',
    needByDate: '2024-09-30',
    open: false,
    plant: 'CHI-MFG',
    lines: [
      {
        PartNum: 'STL-CL-CR-040',
        LineDesc: 'Cold Rolled Steel Coil 0.040" (Sept lot)',
        OrderQty: 28,
        UOM: 'TON',
        UnitCost: 925.0,
      },
    ],
  }),
  makePO({
    num: 'PO-2024-00052',
    vendor: 'V-10211',
    orderDate: '2024-09-15',
    needByDate: '2024-09-30',
    open: false,
    plant: 'CLE-MFG',
    lines: [
      {
        PartNum: 'LUB-DRAW-HD-55',
        LineDesc: 'Heavy-Duty Drawing Lubricant (Q3)',
        OrderQty: 8,
        UOM: 'DRM',
        UnitCost: 1820.0,
      },
    ],
  }),
  makePO({
    num: 'PO-2024-00053',
    vendor: 'V-10501',
    orderDate: '2024-09-18',
    needByDate: '2024-09-25',
    open: false,
    plant: 'DET-MFG',
    lines: [
      {
        PartNum: 'MRO-FAS-M8x35',
        LineDesc: 'Hex Bolt M8 x 35mm (Q3 stock)',
        OrderQty: 4000,
        UOM: 'EA',
        UnitCost: 0.4,
      },
    ],
  }),
  makePO({
    num: 'PO-2024-00054',
    vendor: 'V-10330',
    orderDate: '2024-09-20',
    needByDate: '2024-10-05',
    open: false,
    plant: 'CHI-MFG',
    lines: [
      {
        PartNum: 'PKG-COR-48x40',
        LineDesc: 'Corrugated Cardboard Sheets 48"x40" (Q3)',
        OrderQty: 4000,
        UOM: 'EA',
        UnitCost: 2.75,
      },
    ],
  }),
  makePO({
    num: 'PO-2024-00055',
    vendor: 'V-10721',
    orderDate: '2024-09-22',
    needByDate: '2024-10-15',
    open: false,
    plant: 'CLE-MFG',
    lines: [
      {
        PartNum: 'FRT-LCL-CLE-DET',
        LineDesc: 'LTL Freight Cleveland→Detroit (Sept)',
        OrderQty: 1,
        UOM: 'EA',
        UnitCost: 5400.0,
      },
    ],
  }),
  makePO({
    num: 'PO-2024-00056',
    vendor: 'V-10502',
    orderDate: '2024-09-25',
    needByDate: '2024-10-05',
    open: false,
    plant: 'DET-MFG',
    lines: [
      {
        PartNum: 'MRO-CUT-INS-CRB',
        LineDesc: 'Carbide Cutting Insert (Q3 stock)',
        OrderQty: 150,
        UOM: 'EA',
        UnitCost: 18.0,
      },
    ],
  }),
  makePO({
    num: 'PO-2024-00057',
    vendor: 'V-10092',
    orderDate: '2024-08-15',
    needByDate: '2024-10-15',
    open: false,
    plant: 'CHI-MFG',
    lines: [
      {
        PartNum: 'TOOL-PUN-SET-15',
        LineDesc: 'Punch Set 15-Piece Carbide (Q3)',
        OrderQty: 3,
        UOM: 'EA',
        UnitCost: 3380.0,
      },
    ],
  }),
  makePO({
    num: 'PO-2024-00058',
    vendor: 'V-10212',
    orderDate: '2024-09-28',
    needByDate: '2024-10-12',
    open: false,
    plant: 'CLE-MFG',
    lines: [
      {
        PartNum: 'CHM-CL-DEGREASE',
        LineDesc: 'Industrial Degreaser (Q3)',
        OrderQty: 24,
        UOM: 'GAL',
        UnitCost: 142.0,
      },
    ],
  }),
  makePO({
    num: 'PO-2024-00059',
    vendor: 'V-10046',
    orderDate: '2024-08-30',
    needByDate: '2024-10-01',
    open: false,
    plant: 'DET-MFG',
    lines: [
      {
        PartNum: 'AL-CL-5052-050',
        LineDesc: 'Aluminum 5052 Coil 0.050" (Q3)',
        OrderQty: 12,
        UOM: 'TON',
        UnitCost: 2350.0,
      },
    ],
  }),
];

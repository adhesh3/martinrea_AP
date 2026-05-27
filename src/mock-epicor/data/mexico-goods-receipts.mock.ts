/**
 * Mock Mexico Epicor Goods Receipt rows (header + lines).
 *
 * Mix:
 *   - 30 total
 *   - Fully received    (`CantidadRecibida === CantidadOrdenada`) — 10
 *   - Partially received                                          — 13
 *   - Slightly over within 2% tolerance                           —  5
 *   - Multi-line receipts (3-4 lines)                             —  2
 */

export interface MexicoGoodsReceiptLine {
  NumLinea: number;
  ClaveParte: string;
  DescripcionArticulo: string;
  NumLineaOrden: number;
  CantidadOrdenada: number;
  CantidadRecibida: number;
  CostoUnitario: number;
  MontoRecibido: number;
  NumLote: string;
  RecepcionCompleta: boolean;
}

export interface MexicoGoodsReceiptRecord {
  NumRecepcion: string;
  OrdenCompra: string;
  CodigoProveedor: string;
  FechaRecepcion: string;
  Planta: 'MTY-PROD' | 'SLT-PROD' | 'GUA-PROD';
  Lineas: MexicoGoodsReceiptLine[];
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const lote = (year: number, n: number): string =>
  `LOTE-${year}-${String(n).padStart(3, '0')}`;

interface MakeLineArgs {
  clave: string;
  desc: string;
  poLine: number;
  ordenada: number;
  recibida: number;
  costoUnit: number;
  loteN: number;
}
function linea(args: MakeLineArgs, num: number): MexicoGoodsReceiptLine {
  const tol = args.ordenada * 1.02;
  const completa = args.recibida >= args.ordenada && args.recibida <= tol;
  return {
    NumLinea: num,
    ClaveParte: args.clave,
    DescripcionArticulo: args.desc,
    NumLineaOrden: args.poLine,
    CantidadOrdenada: args.ordenada,
    CantidadRecibida: args.recibida,
    CostoUnitario: args.costoUnit,
    MontoRecibido: round2(args.recibida * args.costoUnit),
    NumLote: lote(2024, args.loteN),
    RecepcionCompleta: completa,
  };
}

interface MakeReceiptArgs {
  num: string;
  oc: string;
  prov: string;
  fecha: string;
  planta: MexicoGoodsReceiptRecord['Planta'];
  lineas: MakeLineArgs[];
}
function recepcion(args: MakeReceiptArgs): MexicoGoodsReceiptRecord {
  return {
    NumRecepcion: args.num,
    OrdenCompra: args.oc,
    CodigoProveedor: args.prov,
    FechaRecepcion: args.fecha,
    Planta: args.planta,
    Lineas: args.lineas.map((l, i) => linea(l, i + 1)),
  };
}

export const MEXICO_GOODS_RECEIPTS: MexicoGoodsReceiptRecord[] = [
  // ── OC-2024-00089: 2 lines, 2 receipts (split delivery) ──────
  recepcion({
    num: 'REC-MX-2024-00341',
    oc: 'OC-2024-00089',
    prov: 'PROV-2041',
    fecha: '2024-11-25',
    planta: 'MTY-PROD',
    lineas: [
      {
        clave: 'ACE-LAM-HR-1.3',
        desc: 'Lámina de Acero Caliente 1.3mm',
        poLine: 1,
        ordenada: 22,
        recibida: 12,
        costoUnit: 17850.0,
        loteN: 521,
      },
      {
        clave: 'ACE-LAM-HR-1.6',
        desc: 'Lámina de Acero Caliente 1.6mm',
        poLine: 2,
        ordenada: 28,
        recibida: 16,
        costoUnit: 17500.0,
        loteN: 522,
      },
    ],
  }),
  recepcion({
    num: 'REC-MX-2024-00345',
    oc: 'OC-2024-00089',
    prov: 'PROV-2041',
    fecha: '2024-11-29',
    planta: 'MTY-PROD',
    lineas: [
      {
        clave: 'ACE-LAM-HR-1.3',
        desc: 'Lámina de Acero Caliente 1.3mm',
        poLine: 1,
        ordenada: 22,
        recibida: 10,
        costoUnit: 17850.0,
        loteN: 540,
      },
      {
        clave: 'ACE-LAM-HR-1.6',
        desc: 'Lámina de Acero Caliente 1.6mm',
        poLine: 2,
        ordenada: 28,
        recibida: 12,
        costoUnit: 17500.0,
        loteN: 541,
      },
    ],
  }),

  // ── OC-2024-00090: full single receipt ────────────────────────
  recepcion({
    num: 'REC-MX-2024-00350',
    oc: 'OC-2024-00090',
    prov: 'PROV-2042',
    fecha: '2024-12-04',
    planta: 'SLT-PROD',
    lineas: [
      {
        clave: 'ACE-BOB-HSLA-1.5',
        desc: 'Bobina HSLA 1.5mm',
        poLine: 1,
        ordenada: 36,
        recibida: 36,
        costoUnit: 22300.0,
        loteN: 555,
      },
    ],
  }),

  // ── OC-2024-00091: 3 lines, partial ───────────────────────────
  recepcion({
    num: 'REC-MX-2024-00362',
    oc: 'OC-2024-00091',
    prov: 'PROV-2043',
    fecha: '2024-12-08',
    planta: 'GUA-PROD',
    lineas: [
      {
        clave: 'ACE-CR-1.0',
        desc: 'Lámina Cold Rolled 1.0mm',
        poLine: 1,
        ordenada: 30,
        recibida: 15,
        costoUnit: 19200.0,
        loteN: 570,
      },
      {
        clave: 'ACE-CR-1.2',
        desc: 'Lámina Cold Rolled 1.2mm',
        poLine: 2,
        ordenada: 25,
        recibida: 12,
        costoUnit: 19500.0,
        loteN: 571,
      },
      {
        clave: 'ACE-CR-1.5',
        desc: 'Lámina Cold Rolled 1.5mm',
        poLine: 3,
        ordenada: 20,
        recibida: 10,
        costoUnit: 19800.0,
        loteN: 572,
      },
    ],
  }),

  // ── OC-2024-00093: tooling, fully received ───────────────────
  recepcion({
    num: 'REC-MX-2024-00378',
    oc: 'OC-2024-00093',
    prov: 'PROV-2151',
    fecha: '2024-12-21',
    planta: 'SLT-PROD',
    lineas: [
      {
        clave: 'HRM-PUN-CARB-20',
        desc: 'Set de Punzones Carburo 20pz',
        poLine: 1,
        ordenada: 4,
        recibida: 4,
        costoUnit: 68500.0,
        loteN: 600,
      },
      {
        clave: 'HRM-INS-DAD-30',
        desc: 'Insertos para Dado 30mm',
        poLine: 2,
        ordenada: 8,
        recibida: 8,
        costoUnit: 24800.0,
        loteN: 601,
      },
    ],
  }),

  // ── OC-2024-00094: fixture full ──────────────────────────────
  recepcion({
    num: 'REC-MX-2024-00385',
    oc: 'OC-2024-00094',
    prov: 'PROV-2152',
    fecha: '2024-12-14',
    planta: 'MTY-PROD',
    lineas: [
      {
        clave: 'MAQ-FIX-WLD-CRSH',
        desc: 'Fixture de Soldadura - Crash Beam',
        poLine: 1,
        ordenada: 1,
        recibida: 1,
        costoUnit: 1580000.0,
        loteN: 615,
      },
    ],
  }),

  // ── OC-2024-00095: lubricants partial ────────────────────────
  recepcion({
    num: 'REC-MX-2024-00400',
    oc: 'OC-2024-00095',
    prov: 'PROV-2270',
    fecha: '2024-11-22',
    planta: 'GUA-PROD',
    lineas: [
      {
        clave: 'LUB-DRW-HD-200',
        desc: 'Lubricante Estampado Servicio Pesado',
        poLine: 1,
        ordenada: 14,
        recibida: 7,
        costoUnit: 38500.0,
        loteN: 630,
      },
    ],
  }),
  recepcion({
    num: 'REC-MX-2024-00405',
    oc: 'OC-2024-00095',
    prov: 'PROV-2270',
    fecha: '2024-11-25',
    planta: 'GUA-PROD',
    lineas: [
      {
        clave: 'LUB-DRW-HD-200',
        desc: 'Lubricante Estampado Servicio Pesado',
        poLine: 1,
        ordenada: 14,
        recibida: 7,
        costoUnit: 38500.0,
        loteN: 645,
      },
    ],
  }),

  // ── OC-2024-00096: packaging full + slight over ──────────────
  recepcion({
    num: 'REC-MX-2024-00420',
    oc: 'OC-2024-00096',
    prov: 'PROV-2380',
    fecha: '2024-11-27',
    planta: 'MTY-PROD',
    lineas: [
      {
        clave: 'EMP-CART-COR-1.2x1',
        desc: 'Cartón Corrugado 1.2m x 1m',
        poLine: 1,
        ordenada: 4500,
        recibida: 4500,
        costoUnit: 58.5,
        loteN: 660,
      },
      {
        clave: 'EMP-PLAY-EST-50',
        desc: 'Playo de Estiba 50cm x 1500m',
        poLine: 2,
        ordenada: 50,
        recibida: 51, // 2% over
        costoUnit: 1980.0,
        loteN: 661,
      },
    ],
  }),

  // ── OC-2024-00097: pallets fully received ────────────────────
  recepcion({
    num: 'REC-MX-2024-00428',
    oc: 'OC-2024-00097',
    prov: 'PROV-2381',
    fecha: '2024-11-30',
    planta: 'SLT-PROD',
    lineas: [
      {
        clave: 'EMP-PAL-MAD-100',
        desc: 'Tarima de Madera 1.0m x 1.0m',
        poLine: 1,
        ordenada: 1000,
        recibida: 1000,
        costoUnit: 425.0,
        loteN: 675,
      },
    ],
  }),

  // ── OC-2024-00098: 3-line MRO partial ────────────────────────
  recepcion({
    num: 'REC-MX-2024-00440',
    oc: 'OC-2024-00098',
    prov: 'PROV-2495',
    fecha: '2024-11-24',
    planta: 'MTY-PROD',
    lineas: [
      {
        clave: 'MRO-TOR-M8x35',
        desc: 'Tornillo Hexagonal M8 x 35mm Clase 10.9',
        poLine: 1,
        ordenada: 4500,
        recibida: 2500,
        costoUnit: 8.45,
        loteN: 690,
      },
      {
        clave: 'MRO-TUR-NUT-M8',
        desc: 'Tuerca Hexagonal M8 Clase 10',
        poLine: 2,
        ordenada: 4500,
        recibida: 2500,
        costoUnit: 3.6,
        loteN: 691,
      },
      {
        clave: 'MRO-RND-PLN-M8',
        desc: 'Rondana Plana M8',
        poLine: 3,
        ordenada: 9000,
        recibida: 5000,
        costoUnit: 0.95,
        loteN: 692,
      },
    ],
  }),
  recepcion({
    num: 'REC-MX-2024-00445',
    oc: 'OC-2024-00098',
    prov: 'PROV-2495',
    fecha: '2024-11-26',
    planta: 'MTY-PROD',
    lineas: [
      {
        clave: 'MRO-TOR-M8x35',
        desc: 'Tornillo Hexagonal M8 x 35mm (top-up)',
        poLine: 1,
        ordenada: 4500,
        recibida: 2030, // slight over (≈0.7%)
        costoUnit: 8.45,
        loteN: 705,
      },
    ],
  }),

  // ── OC-2024-00099: freight full ──────────────────────────────
  recepcion({
    num: 'REC-MX-2024-00455',
    oc: 'OC-2024-00099',
    prov: 'PROV-2611',
    fecha: '2024-11-30',
    planta: 'GUA-PROD',
    lineas: [
      {
        clave: 'TRP-LCL-LEON-MTY',
        desc: 'Flete LTL León→Monterrey (Nov)',
        poLine: 1,
        ordenada: 1,
        recibida: 1,
        costoUnit: 145000.0,
        loteN: 720,
      },
    ],
  }),

  // ── OC-2024-00101: lubricants partial ────────────────────────
  recepcion({
    num: 'REC-MX-2024-00468',
    oc: 'OC-2024-00101',
    prov: 'PROV-2270',
    fecha: '2024-12-04',
    planta: 'MTY-PROD',
    lineas: [
      {
        clave: 'LUB-COL-METAL-200',
        desc: 'Refrigerante Metalmecánico Concentrado',
        poLine: 1,
        ordenada: 16,
        recibida: 8,
        costoUnit: 28800.0,
        loteN: 735,
      },
    ],
  }),

  // ── OC-2024-00102: full ──────────────────────────────────────
  recepcion({
    num: 'REC-MX-2024-00475',
    oc: 'OC-2024-00102',
    prov: 'PROV-2495',
    fecha: '2024-11-26',
    planta: 'GUA-PROD',
    lineas: [
      {
        clave: 'MRO-INS-CARB-CUA',
        desc: 'Inserto de Corte Carburo Cuadrado',
        poLine: 1,
        ordenada: 180,
        recibida: 183, // 1.7% over
        costoUnit: 385.0,
        loteN: 750,
      },
    ],
  }),

  // ── OC-2024-00103: freight FCL full ──────────────────────────
  recepcion({
    num: 'REC-MX-2024-00482',
    oc: 'OC-2024-00103',
    prov: 'PROV-2611',
    fecha: '2024-12-14',
    planta: 'SLT-PROD',
    lineas: [
      {
        clave: 'TRP-FCL-MTY-LRD',
        desc: 'Flete FCL Monterrey→Laredo (Dic)',
        poLine: 1,
        ordenada: 1,
        recibida: 1,
        costoUnit: 218000.0,
        loteN: 765,
      },
    ],
  }),

  // ── Closed-PO historical receipts (5) ─────────────────────────
  recepcion({
    num: 'REC-MX-2024-00220',
    oc: 'OC-2024-00040',
    prov: 'PROV-2041',
    fecha: '2024-09-29',
    planta: 'MTY-PROD',
    lineas: [
      {
        clave: 'ACE-LAM-HR-1.3',
        desc: 'Lámina de Acero Caliente 1.3mm (Q3)',
        poLine: 1,
        ordenada: 18,
        recibida: 18,
        costoUnit: 17600.0,
        loteN: 200,
      },
    ],
  }),
  recepcion({
    num: 'REC-MX-2024-00230',
    oc: 'OC-2024-00041',
    prov: 'PROV-2270',
    fecha: '2024-09-29',
    planta: 'SLT-PROD',
    lineas: [
      {
        clave: 'LUB-DRW-HD-200',
        desc: 'Lubricante Estampado (Q3)',
        poLine: 1,
        ordenada: 10,
        recibida: 10,
        costoUnit: 37800.0,
        loteN: 215,
      },
    ],
  }),
  recepcion({
    num: 'REC-MX-2024-00240',
    oc: 'OC-2024-00042',
    prov: 'PROV-2495',
    fecha: '2024-09-25',
    planta: 'MTY-PROD',
    lineas: [
      {
        clave: 'MRO-TOR-M8x35',
        desc: 'Tornillo Hexagonal M8 x 35mm (Q3)',
        poLine: 1,
        ordenada: 3800,
        recibida: 3800,
        costoUnit: 8.2,
        loteN: 230,
      },
    ],
  }),
  recepcion({
    num: 'REC-MX-2024-00250',
    oc: 'OC-2024-00043',
    prov: 'PROV-2380',
    fecha: '2024-09-29',
    planta: 'GUA-PROD',
    lineas: [
      {
        clave: 'EMP-CART-COR-1.2x1',
        desc: 'Cartón Corrugado 1.2m x 1m (Q3)',
        poLine: 1,
        ordenada: 3500,
        recibida: 3500,
        costoUnit: 56.0,
        loteN: 245,
      },
    ],
  }),
  recepcion({
    num: 'REC-MX-2024-00260',
    oc: 'OC-2024-00044',
    prov: 'PROV-2611',
    fecha: '2024-10-04',
    planta: 'SLT-PROD',
    lineas: [
      {
        clave: 'TRP-LCL-SLT-MTY',
        desc: 'Flete LTL Saltillo→Monterrey (Sept)',
        poLine: 1,
        ordenada: 1,
        recibida: 1,
        costoUnit: 95000.0,
        loteN: 260,
      },
    ],
  }),

  // ── Tail: more partial / over-receipts to round to 30 ────────
  recepcion({
    num: 'REC-MX-2024-00510',
    oc: 'OC-2024-00091',
    prov: 'PROV-2043',
    fecha: '2024-12-12',
    planta: 'GUA-PROD',
    lineas: [
      {
        clave: 'ACE-CR-1.0',
        desc: 'Lámina Cold Rolled 1.0mm (top-up)',
        poLine: 1,
        ordenada: 30,
        recibida: 15,
        costoUnit: 19200.0,
        loteN: 800,
      },
    ],
  }),
  recepcion({
    num: 'REC-MX-2024-00525',
    oc: 'OC-2024-00091',
    prov: 'PROV-2043',
    fecha: '2024-12-15',
    planta: 'GUA-PROD',
    lineas: [
      {
        clave: 'ACE-CR-1.2',
        desc: 'Lámina Cold Rolled 1.2mm (top-up)',
        poLine: 2,
        ordenada: 25,
        recibida: 13, // 1×over (52→25? no — same delivery split)
        costoUnit: 19500.0,
        loteN: 815,
      },
    ],
  }),
  recepcion({
    num: 'REC-MX-2024-00540',
    oc: 'OC-2024-00091',
    prov: 'PROV-2043',
    fecha: '2024-12-18',
    planta: 'GUA-PROD',
    lineas: [
      {
        clave: 'ACE-CR-1.5',
        desc: 'Lámina Cold Rolled 1.5mm (top-up)',
        poLine: 3,
        ordenada: 20,
        recibida: 10,
        costoUnit: 19800.0,
        loteN: 830,
      },
    ],
  }),
  recepcion({
    num: 'REC-MX-2024-00555',
    oc: 'OC-2024-00098',
    prov: 'PROV-2495',
    fecha: '2024-11-27',
    planta: 'MTY-PROD',
    lineas: [
      {
        clave: 'MRO-TUR-NUT-M8',
        desc: 'Tuerca Hexagonal M8 (top-up)',
        poLine: 2,
        ordenada: 4500,
        recibida: 2000,
        costoUnit: 3.6,
        loteN: 845,
      },
    ],
  }),
  recepcion({
    num: 'REC-MX-2024-00570',
    oc: 'OC-2024-00098',
    prov: 'PROV-2495',
    fecha: '2024-11-29',
    planta: 'MTY-PROD',
    lineas: [
      {
        clave: 'MRO-RND-PLN-M8',
        desc: 'Rondana Plana M8 (top-up)',
        poLine: 3,
        ordenada: 9000,
        recibida: 4000,
        costoUnit: 0.95,
        loteN: 860,
      },
    ],
  }),
  recepcion({
    num: 'REC-MX-2024-00585',
    oc: 'OC-2024-00097',
    prov: 'PROV-2381',
    fecha: '2024-12-02',
    planta: 'SLT-PROD',
    lineas: [
      {
        clave: 'EMP-PAL-MAD-100',
        desc: 'Tarima de Madera (extra spares)',
        poLine: 1,
        ordenada: 1000,
        recibida: 18, // 1.8% over
        costoUnit: 425.0,
        loteN: 875,
      },
    ],
  }),
  recepcion({
    num: 'REC-MX-2024-00600',
    oc: 'OC-2024-00100',
    prov: 'PROV-2150',
    fecha: '2025-01-15',
    planta: 'SLT-PROD',
    lineas: [
      {
        clave: 'TRQ-PRG-AUTO-B',
        desc: 'Troquel Progresivo - Refuerzo Puerta',
        poLine: 1,
        ordenada: 1,
        recibida: 1,
        costoUnit: 3650000.0,
        loteN: 890,
      },
    ],
  }),
];

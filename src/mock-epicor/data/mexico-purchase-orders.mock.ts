/**
 * Mock Mexico Epicor Purchase Order rows (header + lines).
 *
 * Mix:
 *   - 20 total
 *   - 15 OrdenAbierta=true (open)
 *   -  5 OrdenAbierta=false (closed)
 */

export interface MexicoPurchaseOrderLine {
  NumLinea: number;
  ClaveParte: string;
  Descripcion: string;
  CantidadPedida: number;
  UnidadMedida: 'PZA' | 'KG' | 'TON' | 'LT' | 'TAM' | 'CAJ';
  CostoUnitario: number;
  CostoTotal: number;
  LineaAbierta: boolean;
}

export interface MexicoPurchaseOrderRecord {
  NumOrden: string;
  CodigoProveedor: string;
  FechaPedido: string;
  FechaRequerida: string;
  OrdenAbierta: boolean;
  Comprador: string;
  Moneda: 'MXN';
  TotalOrden: number;
  Planta: 'MTY-PROD' | 'SLT-PROD' | 'GUA-PROD';
  Lineas: MexicoPurchaseOrderLine[];
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

function makePO(args: {
  num: string;
  vendor: string;
  fecha: string;
  requerida: string;
  abierta: boolean;
  comprador?: string;
  planta: MexicoPurchaseOrderRecord['Planta'];
  lineas: Array<
    Omit<MexicoPurchaseOrderLine, 'CostoTotal' | 'LineaAbierta' | 'NumLinea'> & {
      NumLinea?: number;
      LineaAbierta?: boolean;
    }
  >;
}): MexicoPurchaseOrderRecord {
  const Lineas: MexicoPurchaseOrderLine[] = args.lineas.map((l, i) => ({
    NumLinea: l.NumLinea ?? i + 1,
    ClaveParte: l.ClaveParte,
    Descripcion: l.Descripcion,
    CantidadPedida: l.CantidadPedida,
    UnidadMedida: l.UnidadMedida,
    CostoUnitario: l.CostoUnitario,
    CostoTotal: round2(l.CantidadPedida * l.CostoUnitario),
    LineaAbierta: l.LineaAbierta ?? args.abierta,
  }));
  return {
    NumOrden: args.num,
    CodigoProveedor: args.vendor,
    FechaPedido: args.fecha,
    FechaRequerida: args.requerida,
    OrdenAbierta: args.abierta,
    Comprador: args.comprador ?? 'COMP01',
    Moneda: 'MXN',
    TotalOrden: round2(Lineas.reduce((a, l) => a + l.CostoTotal, 0)),
    Planta: args.planta,
    Lineas,
  };
}

export const MEXICO_PURCHASE_ORDERS: MexicoPurchaseOrderRecord[] = [
  // ─── Open POs (15) ────────────────────────────────────────────
  makePO({
    num: 'OC-2024-00089',
    vendor: 'PROV-2041',
    fecha: '2024-11-12',
    requerida: '2024-12-02',
    abierta: true,
    planta: 'MTY-PROD',
    lineas: [
      {
        ClaveParte: 'ACE-LAM-HR-1.3',
        Descripcion: 'Lámina de Acero Caliente 1.3mm',
        CantidadPedida: 22,
        UnidadMedida: 'TON',
        CostoUnitario: 17850.0,
      },
      {
        ClaveParte: 'ACE-LAM-HR-1.6',
        Descripcion: 'Lámina de Acero Caliente 1.6mm',
        CantidadPedida: 28,
        UnidadMedida: 'TON',
        CostoUnitario: 17500.0,
      },
    ],
  }),
  makePO({
    num: 'OC-2024-00090',
    vendor: 'PROV-2042',
    fecha: '2024-11-14',
    requerida: '2024-12-05',
    abierta: true,
    planta: 'SLT-PROD',
    lineas: [
      {
        ClaveParte: 'ACE-BOB-HSLA-1.5',
        Descripcion: 'Bobina HSLA 1.5mm',
        CantidadPedida: 36,
        UnidadMedida: 'TON',
        CostoUnitario: 22300.0,
      },
    ],
  }),
  makePO({
    num: 'OC-2024-00091',
    vendor: 'PROV-2043',
    fecha: '2024-11-17',
    requerida: '2024-12-08',
    abierta: true,
    planta: 'GUA-PROD',
    comprador: 'COMP02',
    lineas: [
      {
        ClaveParte: 'ACE-CR-1.0',
        Descripcion: 'Lámina Cold Rolled 1.0mm',
        CantidadPedida: 30,
        UnidadMedida: 'TON',
        CostoUnitario: 19200.0,
      },
      {
        ClaveParte: 'ACE-CR-1.2',
        Descripcion: 'Lámina Cold Rolled 1.2mm',
        CantidadPedida: 25,
        UnidadMedida: 'TON',
        CostoUnitario: 19500.0,
      },
      {
        ClaveParte: 'ACE-CR-1.5',
        Descripcion: 'Lámina Cold Rolled 1.5mm',
        CantidadPedida: 20,
        UnidadMedida: 'TON',
        CostoUnitario: 19800.0,
      },
    ],
  }),
  makePO({
    num: 'OC-2024-00092',
    vendor: 'PROV-2150',
    fecha: '2024-10-22',
    requerida: '2025-01-30',
    abierta: true,
    planta: 'MTY-PROD',
    comprador: 'COMP03',
    lineas: [
      {
        ClaveParte: 'TRQ-PRG-AUTO-A',
        Descripcion: 'Troquel Progresivo Automotriz - Refuerzo Riel',
        CantidadPedida: 1,
        UnidadMedida: 'PZA',
        CostoUnitario: 2950000.0,
      },
    ],
  }),
  makePO({
    num: 'OC-2024-00093',
    vendor: 'PROV-2151',
    fecha: '2024-11-02',
    requerida: '2024-12-22',
    abierta: true,
    planta: 'SLT-PROD',
    comprador: 'COMP03',
    lineas: [
      {
        ClaveParte: 'HRM-PUN-CARB-20',
        Descripcion: 'Set de Punzones Carburo 20pz',
        CantidadPedida: 4,
        UnidadMedida: 'PZA',
        CostoUnitario: 68500.0,
      },
      {
        ClaveParte: 'HRM-INS-DAD-30',
        Descripcion: 'Insertos para Dado 30mm',
        CantidadPedida: 8,
        UnidadMedida: 'PZA',
        CostoUnitario: 24800.0,
      },
    ],
  }),
  makePO({
    num: 'OC-2024-00094',
    vendor: 'PROV-2152',
    fecha: '2024-11-04',
    requerida: '2024-12-15',
    abierta: true,
    planta: 'MTY-PROD',
    lineas: [
      {
        ClaveParte: 'MAQ-FIX-WLD-CRSH',
        Descripcion: 'Fixture de Soldadura - Crash Beam',
        CantidadPedida: 1,
        UnidadMedida: 'PZA',
        CostoUnitario: 1580000.0,
      },
    ],
  }),
  makePO({
    num: 'OC-2024-00095',
    vendor: 'PROV-2270',
    fecha: '2024-11-06',
    requerida: '2024-11-25',
    abierta: true,
    planta: 'GUA-PROD',
    lineas: [
      {
        ClaveParte: 'LUB-DRW-HD-200',
        Descripcion: 'Lubricante Estampado Servicio Pesado',
        CantidadPedida: 14,
        UnidadMedida: 'TAM',
        CostoUnitario: 38500.0,
      },
    ],
  }),
  makePO({
    num: 'OC-2024-00096',
    vendor: 'PROV-2380',
    fecha: '2024-11-09',
    requerida: '2024-11-28',
    abierta: true,
    planta: 'MTY-PROD',
    lineas: [
      {
        ClaveParte: 'EMP-CART-COR-1.2x1',
        Descripcion: 'Cartón Corrugado 1.2m x 1m',
        CantidadPedida: 4500,
        UnidadMedida: 'PZA',
        CostoUnitario: 58.5,
      },
      {
        ClaveParte: 'EMP-PLAY-EST-50',
        Descripcion: 'Playo de Estiba 50cm x 1500m',
        CantidadPedida: 50,
        UnidadMedida: 'CAJ',
        CostoUnitario: 1980.0,
      },
    ],
  }),
  makePO({
    num: 'OC-2024-00097',
    vendor: 'PROV-2381',
    fecha: '2024-11-10',
    requerida: '2024-12-01',
    abierta: true,
    planta: 'SLT-PROD',
    lineas: [
      {
        ClaveParte: 'EMP-PAL-MAD-100',
        Descripcion: 'Tarima de Madera 1.0m x 1.0m',
        CantidadPedida: 1000,
        UnidadMedida: 'PZA',
        CostoUnitario: 425.0,
      },
    ],
  }),
  makePO({
    num: 'OC-2024-00098',
    vendor: 'PROV-2495',
    fecha: '2024-11-15',
    requerida: '2024-11-25',
    abierta: true,
    planta: 'MTY-PROD',
    lineas: [
      {
        ClaveParte: 'MRO-TOR-M8x35',
        Descripcion: 'Tornillo Hexagonal M8 x 35mm Clase 10.9',
        CantidadPedida: 4500,
        UnidadMedida: 'PZA',
        CostoUnitario: 8.45,
      },
      {
        ClaveParte: 'MRO-TUR-NUT-M8',
        Descripcion: 'Tuerca Hexagonal M8 Clase 10',
        CantidadPedida: 4500,
        UnidadMedida: 'PZA',
        CostoUnitario: 3.6,
      },
      {
        ClaveParte: 'MRO-RND-PLN-M8',
        Descripcion: 'Rondana Plana M8',
        CantidadPedida: 9000,
        UnidadMedida: 'PZA',
        CostoUnitario: 0.95,
      },
    ],
  }),
  makePO({
    num: 'OC-2024-00099',
    vendor: 'PROV-2611',
    fecha: '2024-11-16',
    requerida: '2024-11-30',
    abierta: true,
    planta: 'GUA-PROD',
    lineas: [
      {
        ClaveParte: 'TRP-LCL-LEON-MTY',
        Descripcion: 'Flete LTL León→Monterrey (Nov)',
        CantidadPedida: 1,
        UnidadMedida: 'PZA',
        CostoUnitario: 145000.0,
      },
    ],
  }),
  makePO({
    num: 'OC-2024-00100',
    vendor: 'PROV-2150',
    fecha: '2024-11-18',
    requerida: '2025-01-15',
    abierta: true,
    planta: 'SLT-PROD',
    comprador: 'COMP03',
    lineas: [
      {
        ClaveParte: 'TRQ-PRG-AUTO-B',
        Descripcion: 'Troquel Progresivo - Refuerzo Puerta',
        CantidadPedida: 1,
        UnidadMedida: 'PZA',
        CostoUnitario: 3650000.0,
      },
    ],
  }),
  makePO({
    num: 'OC-2024-00101',
    vendor: 'PROV-2270',
    fecha: '2024-11-19',
    requerida: '2024-12-05',
    abierta: true,
    planta: 'MTY-PROD',
    lineas: [
      {
        ClaveParte: 'LUB-COL-METAL-200',
        Descripcion: 'Refrigerante Metalmecánico Concentrado',
        CantidadPedida: 16,
        UnidadMedida: 'TAM',
        CostoUnitario: 28800.0,
      },
    ],
  }),
  makePO({
    num: 'OC-2024-00102',
    vendor: 'PROV-2495',
    fecha: '2024-11-20',
    requerida: '2024-11-27',
    abierta: true,
    planta: 'GUA-PROD',
    lineas: [
      {
        ClaveParte: 'MRO-INS-CARB-CUA',
        Descripcion: 'Inserto de Corte Carburo Cuadrado',
        CantidadPedida: 180,
        UnidadMedida: 'PZA',
        CostoUnitario: 385.0,
      },
    ],
  }),
  makePO({
    num: 'OC-2024-00103',
    vendor: 'PROV-2611',
    fecha: '2024-11-22',
    requerida: '2024-12-15',
    abierta: true,
    planta: 'SLT-PROD',
    lineas: [
      {
        ClaveParte: 'TRP-FCL-MTY-LRD',
        Descripcion: 'Flete FCL Monterrey→Laredo (Dic)',
        CantidadPedida: 1,
        UnidadMedida: 'PZA',
        CostoUnitario: 218000.0,
      },
    ],
  }),

  // ─── Closed POs (5) — must be filtered out by sync ────────────
  makePO({
    num: 'OC-2024-00040',
    vendor: 'PROV-2041',
    fecha: '2024-09-08',
    requerida: '2024-09-30',
    abierta: false,
    planta: 'MTY-PROD',
    lineas: [
      {
        ClaveParte: 'ACE-LAM-HR-1.3',
        Descripcion: 'Lámina de Acero Caliente 1.3mm (Q3)',
        CantidadPedida: 18,
        UnidadMedida: 'TON',
        CostoUnitario: 17600.0,
      },
    ],
  }),
  makePO({
    num: 'OC-2024-00041',
    vendor: 'PROV-2270',
    fecha: '2024-09-12',
    requerida: '2024-09-30',
    abierta: false,
    planta: 'SLT-PROD',
    lineas: [
      {
        ClaveParte: 'LUB-DRW-HD-200',
        Descripcion: 'Lubricante Estampado (Q3)',
        CantidadPedida: 10,
        UnidadMedida: 'TAM',
        CostoUnitario: 37800.0,
      },
    ],
  }),
  makePO({
    num: 'OC-2024-00042',
    vendor: 'PROV-2495',
    fecha: '2024-09-15',
    requerida: '2024-09-25',
    abierta: false,
    planta: 'MTY-PROD',
    lineas: [
      {
        ClaveParte: 'MRO-TOR-M8x35',
        Descripcion: 'Tornillo Hexagonal M8 x 35mm (Q3)',
        CantidadPedida: 3800,
        UnidadMedida: 'PZA',
        CostoUnitario: 8.2,
      },
    ],
  }),
  makePO({
    num: 'OC-2024-00043',
    vendor: 'PROV-2380',
    fecha: '2024-09-18',
    requerida: '2024-09-30',
    abierta: false,
    planta: 'GUA-PROD',
    lineas: [
      {
        ClaveParte: 'EMP-CART-COR-1.2x1',
        Descripcion: 'Cartón Corrugado 1.2m x 1m (Q3)',
        CantidadPedida: 3500,
        UnidadMedida: 'PZA',
        CostoUnitario: 56.0,
      },
    ],
  }),
  makePO({
    num: 'OC-2024-00044',
    vendor: 'PROV-2611',
    fecha: '2024-09-22',
    requerida: '2024-10-05',
    abierta: false,
    planta: 'SLT-PROD',
    lineas: [
      {
        ClaveParte: 'TRP-LCL-SLT-MTY',
        Descripcion: 'Flete LTL Saltillo→Monterrey (Sept)',
        CantidadPedida: 1,
        UnidadMedida: 'PZA',
        CostoUnitario: 95000.0,
      },
    ],
  }),
];

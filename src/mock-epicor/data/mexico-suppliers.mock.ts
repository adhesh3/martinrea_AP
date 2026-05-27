/**
 * Mock supplier rows in Mexico Epicor's native shape.
 *
 * Field names follow the Spanish localisation Martinrea uses on the Mexico
 * plant Epicor instances. Note the "opposite-polarity" boolean — `Activo`
 * is true when the supplier is active, where the US side uses `InActive`.
 *
 * Mix:
 *   - 15 total
 *   - 12 active   (`Activo === true`)
 *   -  3 inactive (`Activo === false`)
 */

export interface MexicoSupplierRecord {
  CodigoProveedor: string;
  NombreProveedor: string;
  RFC: string;
  Direccion: string;
  Ciudad: string;
  Estado: string;
  Pais: 'Mexico';
  Activo: boolean;
  TipoProveedor: 'PROVEEDOR';
  Moneda: 'MXN';
  CondicionesPago: 'NETO30' | 'NETO45' | 'NETO60' | 'NETO90';
}

export const MEXICO_SUPPLIERS: MexicoSupplierRecord[] = [
  // ── Acero / metales (4) ────────────────────────────────────────
  {
    CodigoProveedor: 'PROV-2041',
    NombreProveedor: 'Aceros del Norte S.A. de C.V.',
    RFC: 'ANO850301ABC',
    Direccion: 'Blvd. Industrial 4521',
    Ciudad: 'Monterrey',
    Estado: 'Nuevo León',
    Pais: 'Mexico',
    Activo: true,
    TipoProveedor: 'PROVEEDOR',
    Moneda: 'MXN',
    CondicionesPago: 'NETO30',
  },
  {
    CodigoProveedor: 'PROV-2042',
    NombreProveedor: 'Industrias Acero Saltillo S.A. de C.V.',
    RFC: 'IAS920104XYZ',
    Direccion: 'Av. Universidad 1200',
    Ciudad: 'Saltillo',
    Estado: 'Coahuila',
    Pais: 'Mexico',
    Activo: true,
    TipoProveedor: 'PROVEEDOR',
    Moneda: 'MXN',
    CondicionesPago: 'NETO45',
  },
  {
    CodigoProveedor: 'PROV-2043',
    NombreProveedor: 'Bobinas Industriales del Bajío S.A.',
    RFC: 'BIB880505QRS',
    Direccion: 'Carretera Federal Km 14',
    Ciudad: 'León',
    Estado: 'Guanajuato',
    Pais: 'Mexico',
    Activo: true,
    TipoProveedor: 'PROVEEDOR',
    Moneda: 'MXN',
    CondicionesPago: 'NETO30',
  },
  {
    CodigoProveedor: 'PROV-2044',
    NombreProveedor: 'Aluminio del Pacífico S.A. de C.V.',
    RFC: 'ADP910717GHI',
    Direccion: 'Parque Industrial Toluca 2000',
    Ciudad: 'Toluca',
    Estado: 'Estado de México',
    Pais: 'Mexico',
    Activo: false, // INACTIVE — should be filtered out
    TipoProveedor: 'PROVEEDOR',
    Moneda: 'MXN',
    CondicionesPago: 'NETO30',
  },

  // ── Herramentales (3) ──────────────────────────────────────────
  {
    CodigoProveedor: 'PROV-2150',
    NombreProveedor: 'Troqueles y Matrices Monterrey S.A.',
    RFC: 'TMM930211LMN',
    Direccion: 'Av. Eugenio Garza Sada 5500',
    Ciudad: 'Monterrey',
    Estado: 'Nuevo León',
    Pais: 'Mexico',
    Activo: true,
    TipoProveedor: 'PROVEEDOR',
    Moneda: 'MXN',
    CondicionesPago: 'NETO45',
  },
  {
    CodigoProveedor: 'PROV-2151',
    NombreProveedor: 'Herramentales Saltillo S.A. de C.V.',
    RFC: 'HSA970818DEF',
    Direccion: 'Calzada Antonio Cárdenas 850',
    Ciudad: 'Saltillo',
    Estado: 'Coahuila',
    Pais: 'Mexico',
    Activo: true,
    TipoProveedor: 'PROVEEDOR',
    Moneda: 'MXN',
    CondicionesPago: 'NETO60',
  },
  {
    CodigoProveedor: 'PROV-2152',
    NombreProveedor: 'Maquinados Industriales del Norte',
    RFC: 'MIN860923TUV',
    Direccion: 'Parque Industrial Apodaca',
    Ciudad: 'Apodaca',
    Estado: 'Nuevo León',
    Pais: 'Mexico',
    Activo: true,
    TipoProveedor: 'PROVEEDOR',
    Moneda: 'MXN',
    CondicionesPago: 'NETO45',
  },

  // ── Lubricantes / químicos (2) ─────────────────────────────────
  {
    CodigoProveedor: 'PROV-2270',
    NombreProveedor: 'Lubricantes Industriales del Bajío S.A.',
    RFC: 'LIB901103OPQ',
    Direccion: 'Blvd. Aeropuerto 980',
    Ciudad: 'Querétaro',
    Estado: 'Querétaro',
    Pais: 'Mexico',
    Activo: true,
    TipoProveedor: 'PROVEEDOR',
    Moneda: 'MXN',
    CondicionesPago: 'NETO30',
  },
  {
    CodigoProveedor: 'PROV-2271',
    NombreProveedor: 'Químicos del Norte S.A. de C.V.',
    RFC: 'QDN891212JKL',
    Direccion: 'Av. Industria 4400',
    Ciudad: 'Monterrey',
    Estado: 'Nuevo León',
    Pais: 'Mexico',
    Activo: false, // INACTIVE
    TipoProveedor: 'PROVEEDOR',
    Moneda: 'MXN',
    CondicionesPago: 'NETO30',
  },

  // ── Empaques (2) ───────────────────────────────────────────────
  {
    CodigoProveedor: 'PROV-2380',
    NombreProveedor: 'Empaques Industriales de México S.A.',
    RFC: 'EIM030505NOP',
    Direccion: 'Carretera a Reynosa Km 7',
    Ciudad: 'García',
    Estado: 'Nuevo León',
    Pais: 'Mexico',
    Activo: true,
    TipoProveedor: 'PROVEEDOR',
    Moneda: 'MXN',
    CondicionesPago: 'NETO30',
  },
  {
    CodigoProveedor: 'PROV-2381',
    NombreProveedor: 'Cartón Industrial Monterrey S.A.',
    RFC: 'CIM940611RST',
    Direccion: 'Av. Acueducto 1100',
    Ciudad: 'Monterrey',
    Estado: 'Nuevo León',
    Pais: 'Mexico',
    Activo: true,
    TipoProveedor: 'PROVEEDOR',
    Moneda: 'MXN',
    CondicionesPago: 'NETO45',
  },

  // ── MRO (2) ────────────────────────────────────────────────────
  {
    CodigoProveedor: 'PROV-2495',
    NombreProveedor: 'Suministros Industriales del Norte S.A.',
    RFC: 'SIN880404UVW',
    Direccion: 'Blvd. Constitución 2500',
    Ciudad: 'Monterrey',
    Estado: 'Nuevo León',
    Pais: 'Mexico',
    Activo: true,
    TipoProveedor: 'PROVEEDOR',
    Moneda: 'MXN',
    CondicionesPago: 'NETO30',
  },
  {
    CodigoProveedor: 'PROV-2496',
    NombreProveedor: 'MRO Industrial Saltillo S.A.',
    RFC: 'MIS961020YZA',
    Direccion: 'Periférico Norte 4400',
    Ciudad: 'Saltillo',
    Estado: 'Coahuila',
    Pais: 'Mexico',
    Activo: false, // INACTIVE
    TipoProveedor: 'PROVEEDOR',
    Moneda: 'MXN',
    CondicionesPago: 'NETO30',
  },

  // ── Logística (2) ──────────────────────────────────────────────
  {
    CodigoProveedor: 'PROV-2611',
    NombreProveedor: 'Transportes del Norte S.A. de C.V.',
    RFC: 'TDN850811BCD',
    Direccion: 'Av. Diesel 1820',
    Ciudad: 'Apodaca',
    Estado: 'Nuevo León',
    Pais: 'Mexico',
    Activo: true,
    TipoProveedor: 'PROVEEDOR',
    Moneda: 'MXN',
    CondicionesPago: 'NETO30',
  },
  {
    CodigoProveedor: 'PROV-2612',
    NombreProveedor: 'Logística Saltillo S.A. de C.V.',
    RFC: 'LSA920917EFG',
    Direccion: 'Periférico Sur 1200',
    Ciudad: 'Saltillo',
    Estado: 'Coahuila',
    Pais: 'Mexico',
    Activo: true,
    TipoProveedor: 'PROVEEDOR',
    Moneda: 'MXN',
    CondicionesPago: 'NETO45',
  },
];

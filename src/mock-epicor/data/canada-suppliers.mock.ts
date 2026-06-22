/**
 * Mock supplier rows in Canada Epicor's native shape.
 *
 * Canada Epicor uses the same English `Vendor` localisation as the US plants
 * (per the integration spec: "Canada SFTP — same shape as US, exported
 * nightly"), so this fixture reuses the US field names. The only regional
 * differences are economic, not structural:
 *   - `Country` is `'CA'`
 *   - `CurrencyCode` is `'CAD'`
 *   - `VendorId` is a Canada Business Number (BN15), not a US EIN
 *   - `State` carries a province code (ON / QC / ...)
 *
 * Mix:
 *   - 12 total rows
 *   - 10 active   (`InActive === false`)
 *   -  2 inactive (`InActive === true`) — to test that the sync filters them
 */

export interface CanadaSupplierRecord {
  VendorNum: string;
  Name: string;
  VendorId: string;
  Address1: string;
  City: string;
  State: string;
  Country: 'CA';
  InActive: boolean;
  VendorType: 'SUP';
  CurrencyCode: 'CAD';
  PayTerms: 'NET30' | 'NET45' | 'NET60' | 'NET90';
}

export const CANADA_SUPPLIERS: CanadaSupplierRecord[] = [
  // ── Steel & raw metal (4) ──────────────────────────────────────
  {
    VendorNum: 'V-20051',
    Name: 'Algoma Steel Inc.',
    VendorId: '84621 5532 RT0001',
    Address1: '105 West St',
    City: 'Sault Ste. Marie',
    State: 'ON',
    Country: 'CA',
    InActive: false,
    VendorType: 'SUP',
    CurrencyCode: 'CAD',
    PayTerms: 'NET30',
  },
  {
    VendorNum: 'V-20052',
    Name: 'Stelco Inc.',
    VendorId: '73910 4488 RT0001',
    Address1: '386 Wilcox St',
    City: 'Hamilton',
    State: 'ON',
    Country: 'CA',
    InActive: false,
    VendorType: 'SUP',
    CurrencyCode: 'CAD',
    PayTerms: 'NET45',
  },
  {
    VendorNum: 'V-20053',
    Name: 'ArcelorMittal Dofasco G.P.',
    VendorId: '88204 1190 RT0001',
    Address1: '1330 Burlington St E',
    City: 'Hamilton',
    State: 'ON',
    Country: 'CA',
    InActive: false,
    VendorType: 'SUP',
    CurrencyCode: 'CAD',
    PayTerms: 'NET30',
  },
  {
    VendorNum: 'V-20054',
    Name: 'Samuel, Son & Co. Limited',
    VendorId: '10293 7765 RT0001',
    Address1: '2360 Dixie Rd',
    City: 'Mississauga',
    State: 'ON',
    Country: 'CA',
    InActive: true, // INACTIVE — consolidated into national account
    VendorType: 'SUP',
    CurrencyCode: 'CAD',
    PayTerms: 'NET30',
  },

  // ── Tooling, die, mould (3) ────────────────────────────────────
  {
    VendorNum: 'V-20091',
    Name: 'Cambridge Tool & Die Ltd.',
    VendorId: '40118 8821 RT0001',
    Address1: '720 Industrial Rd',
    City: 'Cambridge',
    State: 'ON',
    Country: 'CA',
    InActive: false,
    VendorType: 'SUP',
    CurrencyCode: 'CAD',
    PayTerms: 'NET60',
  },
  {
    VendorNum: 'V-20092',
    Name: 'Windsor Mold & Stamping Inc.',
    VendorId: '55207 3344 RT0001',
    Address1: '4035 Sandwich St',
    City: 'Windsor',
    State: 'ON',
    Country: 'CA',
    InActive: false,
    VendorType: 'SUP',
    CurrencyCode: 'CAD',
    PayTerms: 'NET60',
  },
  {
    VendorNum: 'V-20093',
    Name: 'Outils de Précision Laurentides',
    VendorId: '62880 1907 RT0001',
    Address1: '1450 Rue Industrielle',
    City: 'Boisbriand',
    State: 'QC',
    Country: 'CA',
    InActive: false,
    VendorType: 'SUP',
    CurrencyCode: 'CAD',
    PayTerms: 'NET45',
  },

  // ── Lubricants & chemicals (2) ─────────────────────────────────
  {
    VendorNum: 'V-20211',
    Name: 'Quaker Houghton Canada Inc.',
    VendorId: '30551 9082 RT0001',
    Address1: '2150 Meadowvale Blvd',
    City: 'Mississauga',
    State: 'ON',
    Country: 'CA',
    InActive: false,
    VendorType: 'SUP',
    CurrencyCode: 'CAD',
    PayTerms: 'NET30',
  },
  {
    VendorNum: 'V-20212',
    Name: 'Recochem Inc.',
    VendorId: '71440 2256 RT0001',
    Address1: '850 Montée de Liesse',
    City: 'Montreal',
    State: 'QC',
    Country: 'CA',
    InActive: true, // INACTIVE
    VendorType: 'SUP',
    CurrencyCode: 'CAD',
    PayTerms: 'NET30',
  },

  // ── Packaging (1) ──────────────────────────────────────────────
  {
    VendorNum: 'V-20330',
    Name: 'Cascades Canada ULC',
    VendorId: '90017 6643 RT0001',
    Address1: '404 Boul Marie-Victorin',
    City: 'Kingsey Falls',
    State: 'QC',
    Country: 'CA',
    InActive: false,
    VendorType: 'SUP',
    CurrencyCode: 'CAD',
    PayTerms: 'NET30',
  },

  // ── MRO (1) ────────────────────────────────────────────────────
  {
    VendorNum: 'V-20501',
    Name: 'Acklands-Grainger Inc.',
    VendorId: '12005 4471 RT0001',
    Address1: '90 West Beaver Creek Rd',
    City: 'Richmond Hill',
    State: 'ON',
    Country: 'CA',
    InActive: false,
    VendorType: 'SUP',
    CurrencyCode: 'CAD',
    PayTerms: 'NET30',
  },

  // ── Logistics / freight (1) ────────────────────────────────────
  {
    VendorNum: 'V-20721',
    Name: 'Day & Ross Freight Inc.',
    VendorId: '47712 8830 RT0001',
    Address1: '398 Main St',
    City: 'Hartland',
    State: 'NB',
    Country: 'CA',
    InActive: false,
    VendorType: 'SUP',
    CurrencyCode: 'CAD',
    PayTerms: 'NET45',
  },
];

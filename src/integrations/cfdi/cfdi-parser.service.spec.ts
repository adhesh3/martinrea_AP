import { CfdiParserService } from './cfdi-parser.service';

const FULL_VALID_XML = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/3"
                  xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital"
                  Version="3.3"
                  Sello="MOCK_SELLO_BASE64=="
                  NoCertificado="00001000000500000001"
                  Total="116.00">
  <cfdi:Emisor Rfc="AAA010101AAA"/>
  <cfdi:Receptor Rfc="MAR050101ABC"/>
  <cfdi:Impuestos TotalImpuestosTrasladados="16.00"/>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital UUID="A1B2C3D4-E5F6-7890-ABCD-1234567890AB"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

/**
 * Build a CFDI XML with the given overrides applied. Set a key to `null`
 * to drop the corresponding attribute / element.
 */
interface FixtureOverrides {
  uuid?: string | null;
  emisorRfc?: string | null;
  receptorRfc?: string | null;
  sello?: string | null;
  noCertificado?: string | null;
  total?: string | null;
  iva?: string | null;
}

function buildXml(overrides: FixtureOverrides = {}): string {
  const attr = (key: string, value: string | null | undefined) =>
    value === null ? '' : `${key}="${value ?? ''}"`;
  const sello =
    overrides.sello === undefined ? 'MOCK_SELLO_BASE64==' : overrides.sello;
  const noCert =
    overrides.noCertificado === undefined
      ? '00001000000500000001'
      : overrides.noCertificado;
  const total = overrides.total === undefined ? '116.00' : overrides.total;
  const emisorRfc =
    overrides.emisorRfc === undefined ? 'AAA010101AAA' : overrides.emisorRfc;
  const receptorRfc =
    overrides.receptorRfc === undefined ? 'MAR050101ABC' : overrides.receptorRfc;
  const iva = overrides.iva === undefined ? '16.00' : overrides.iva;
  const uuid =
    overrides.uuid === undefined
      ? 'A1B2C3D4-E5F6-7890-ABCD-1234567890AB'
      : overrides.uuid;

  const emisorTag =
    overrides.emisorRfc === null
      ? '<cfdi:Emisor/>'
      : `<cfdi:Emisor ${attr('Rfc', emisorRfc)}/>`;
  const receptorTag =
    overrides.receptorRfc === null
      ? '<cfdi:Receptor/>'
      : `<cfdi:Receptor ${attr('Rfc', receptorRfc)}/>`;
  const impuestosTag =
    overrides.iva === null
      ? '<cfdi:Impuestos/>'
      : `<cfdi:Impuestos ${attr('TotalImpuestosTrasladados', iva)}/>`;
  const tfdTag =
    overrides.uuid === null
      ? ''
      : `<tfd:TimbreFiscalDigital ${attr('UUID', uuid)}/>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/3"
                  xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital"
                  Version="3.3"
                  ${attr('Sello', sello)}
                  ${attr('NoCertificado', noCert)}
                  ${attr('Total', total)}>
  ${emisorTag}
  ${receptorTag}
  ${impuestosTag}
  <cfdi:Complemento>
    ${tfdTag}
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

describe('CfdiParserService', () => {
  let parser: CfdiParserService;

  beforeEach(() => {
    parser = new CfdiParserService();
  });

  it('1. Valid CFDI XML → isValid: true, no violations', () => {
    const result = parser.parseAndValidate(FULL_VALID_XML);
    expect(result.violations).toEqual([]);
    expect(result.isValid).toBe(true);
    expect(result.fields.uuid).toBe('A1B2C3D4-E5F6-7890-ABCD-1234567890AB');
    expect(result.fields.emisorRfc).toBe('AAA010101AAA');
    expect(result.fields.total).toBe(116);
    expect(result.fields.iva).toBe(16);
  });

  it('2. Missing UUID → "Missing required field: UUID"', () => {
    const xml = buildXml({ uuid: null });
    const result = parser.parseAndValidate(xml);
    expect(result.isValid).toBe(false);
    expect(result.violations).toContain('Missing required field: UUID');
  });

  it('3. Invalid UUID format → "Invalid UUID format"', () => {
    const xml = buildXml({ uuid: 'not-a-uuid' });
    const result = parser.parseAndValidate(xml);
    expect(result.isValid).toBe(false);
    expect(
      result.violations.some((v) => v.startsWith('Invalid UUID format')),
    ).toBe(true);
  });

  it('4. Invalid Emisor RFC format → "Invalid Emisor RFC format"', () => {
    const xml = buildXml({ emisorRfc: 'abc' });
    const result = parser.parseAndValidate(xml);
    expect(result.isValid).toBe(false);
    expect(
      result.violations.some((v) =>
        v.startsWith('Invalid Emisor RFC format'),
      ),
    ).toBe(true);
  });

  it('5. Missing Total → "Missing required field: Total"', () => {
    const xml = buildXml({ total: null });
    const result = parser.parseAndValidate(xml);
    expect(result.isValid).toBe(false);
    expect(result.violations).toContain('Missing required field: Total');
  });

  it('6. Negative Total → "Total must be a positive number"', () => {
    const xml = buildXml({ total: '-50' });
    const result = parser.parseAndValidate(xml);
    expect(result.isValid).toBe(false);
    expect(result.violations).toContain('Total must be a positive number');
  });

  it('7. Missing Sello → "Missing required field: Sello"', () => {
    const xml = buildXml({ sello: null });
    const result = parser.parseAndValidate(xml);
    expect(result.isValid).toBe(false);
    expect(result.violations).toContain('Missing required field: Sello');
  });

  it('8. Multiple violations are all listed in the violations array', () => {
    const xml = buildXml({
      uuid: 'bad',
      emisorRfc: 'abc',
      total: null,
      sello: null,
    });
    const result = parser.parseAndValidate(xml);
    expect(result.isValid).toBe(false);
    expect(
      result.violations.some((v) => v.startsWith('Invalid UUID format')),
    ).toBe(true);
    expect(
      result.violations.some((v) =>
        v.startsWith('Invalid Emisor RFC format'),
      ),
    ).toBe(true);
    expect(result.violations).toContain('Missing required field: Total');
    expect(result.violations).toContain('Missing required field: Sello');
  });
});

// npm install fast-xml-parser

import { Injectable, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';

/**
 * Result of parsing + structurally validating a CFDI XML payload.
 *
 * `fields` always contains every key, with `null` for anything that couldn't
 * be located. The caller decides how to handle violations — e.g. wrap them
 * into a `CfdiValidationResultDto.violationReason` after the SAT lookup.
 */
export interface CfdiParseResult {
  isValid: boolean;
  fields: {
    uuid: string | null;
    emisorRfc: string | null;
    receptorRfc: string | null;
    sello: string | null;
    noCertificado: string | null;
    total: number | null;
    iva: number | null;
  };
  violations: string[];
}

/**
 * Standard UUID v1–v5 format, case-insensitive.
 * SAT CFDI UUIDs are v4 but conform to this shape.
 */
const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Mexican RFC: 12 chars (companies / "personas morales") or 13 chars
 * (individuals / "personas físicas").
 */
const RFC_REGEX = /^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$/;

/**
 * Parses Mexican CFDI 3.3 XML invoice files and validates all mandatory SAT
 * fields. Performs *no* SAT calls — that lives in `SatValidatorService`.
 */
@Injectable()
export class CfdiParserService {
  private readonly logger = new Logger(CfdiParserService.name);

  private readonly xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    // Strip `cfdi:`, `tfd:` etc so element paths match the spec verbatim.
    removeNSPrefix: true,
    // Keep all attribute values as strings — we control numeric coercion.
    parseAttributeValue: false,
    trimValues: false,
  });

  /**
   * Parse a CFDI XML document and validate the mandatory SAT fields.
   *
   * Synchronous on purpose — `fast-xml-parser` is synchronous and the
   * ingestion pipeline keeps I/O (`readFromBlob`) separate from parsing.
   */
  parseAndValidate(xmlContent: string): CfdiParseResult {
    const violations: string[] = [];
    const emptyFields: CfdiParseResult['fields'] = {
      uuid: null,
      emisorRfc: null,
      receptorRfc: null,
      sello: null,
      noCertificado: null,
      total: null,
      iva: null,
    };

    // Unit test: pass empty / whitespace-only input and assert violation.
    if (!xmlContent || xmlContent.trim().length === 0) {
      return {
        isValid: false,
        fields: emptyFields,
        violations: ['Missing required field: XML content is empty'],
      };
    }

    let parsed: unknown;
    try {
      parsed = this.xmlParser.parse(xmlContent);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to parse CFDI XML: ${message}`);
      return {
        isValid: false,
        fields: emptyFields,
        violations: [`Failed to parse CFDI XML: ${message}`],
      };
    }

    // Unit test: pass an XML with a different root and assert violation.
    const comprobante = getChild(parsed, 'Comprobante');
    if (!comprobante) {
      return {
        isValid: false,
        fields: emptyFields,
        violations: ['Missing required field: Comprobante (root element)'],
      };
    }

    const sello = getAttr(comprobante, 'Sello');
    const noCertificado = getAttr(comprobante, 'NoCertificado');
    const totalRaw = getAttr(comprobante, 'Total');
    const total = parseFloatOrNull(totalRaw);

    const emisor = getChild(comprobante, 'Emisor');
    const emisorRfc = getAttr(emisor, 'Rfc');

    const receptor = getChild(comprobante, 'Receptor');
    const receptorRfc = getAttr(receptor, 'Rfc');

    const impuestos = getChild(comprobante, 'Impuestos');
    const ivaRaw = getAttr(impuestos, 'TotalImpuestosTrasladados');
    const iva = parseFloatOrNull(ivaRaw);

    const complemento = getChild(comprobante, 'Complemento');
    const timbre = getChild(complemento, 'TimbreFiscalDigital');
    const uuid = getAttr(timbre, 'UUID');

    // Unit test: drop the TimbreFiscalDigital node and assert
    //   "Missing required field: UUID".
    if (uuid === null) {
      violations.push('Missing required field: UUID');
    } else if (!UUID_REGEX.test(uuid)) {
      // Unit test: pass UUID="not-a-uuid" and assert "Invalid UUID format".
      violations.push(`Invalid UUID format: ${uuid}`);
    }

    // Unit test: drop the Emisor element and assert violation.
    if (emisorRfc === null) {
      violations.push('Missing required field: Emisor RFC');
    } else if (!RFC_REGEX.test(emisorRfc)) {
      // Unit test: pass Rfc="abc" (lowercase / too short) and assert
      // "Invalid Emisor RFC format".
      violations.push(`Invalid Emisor RFC format: ${emisorRfc}`);
    }

    // Unit test: drop the Receptor element and assert violation.
    if (receptorRfc === null) {
      violations.push('Missing required field: Receptor RFC');
    } else if (!RFC_REGEX.test(receptorRfc)) {
      // Unit test: pass Rfc="X" (too short) and assert format violation.
      violations.push(`Invalid Receptor RFC format: ${receptorRfc}`);
    }

    // Unit test: drop the @_Sello attribute and assert violation.
    if (sello === null) {
      violations.push('Missing required field: Sello');
    }

    // Unit test: drop the @_NoCertificado attribute and assert violation.
    if (noCertificado === null) {
      violations.push('Missing required field: NoCertificado');
    }

    // Unit test: drop @_Total → "Missing required field: Total".
    // Unit test: Total="-50" → "Total must be a positive number".
    // Unit test: Total="0" → "Total must be a positive number" (CFDIs of
    // value 0 are not allowed by Martinrea's AP rules).
    if (total === null) {
      violations.push('Missing required field: Total');
    } else if (!(total > 0)) {
      violations.push('Total must be a positive number');
    }

    // Unit test: drop the Impuestos element → missing-field violation.
    // Unit test: IVA="-1" → "IVA must be a non-negative number".
    // IVA=0 is legal (some products are 0% IVA).
    if (iva === null) {
      violations.push(
        'Missing required field: IVA (TotalImpuestosTrasladados)',
      );
    } else if (iva < 0) {
      violations.push('IVA must be a non-negative number');
    }

    return {
      isValid: violations.length === 0,
      fields: {
        uuid,
        emisorRfc,
        receptorRfc,
        sello,
        noCertificado,
        total,
        iva,
      },
      violations,
    };
  }

  /**
   * Load a CFDI XML payload from blob storage.
   *
   * TODO: integrate with Roshni's blob storage utility (Azure Blob Storage
   *       client wired through the platform's secrets manager). Until that
   *       lands, this returns a hardcoded sample so the rest of the
   *       ingestion pipeline can be developed and unit-tested end-to-end.
   */
  async readFromBlob(_blobPath: string): Promise<string> {
    return SAMPLE_CFDI_XML;
  }
}

/**
 * Safely fetch a child element from a parsed-XML node tree.
 * Returns `null` when the node isn't an object or the child is absent.
 */
function getChild(node: unknown, name: string): unknown {
  if (typeof node !== 'object' || node === null) {
    return null;
  }
  const value = (node as Record<string, unknown>)[name];
  return value ?? null;
}

/**
 * Safely fetch an attribute value (prefixed with `@_` by fast-xml-parser).
 * Returns `null` for missing or whitespace-only values.
 */
function getAttr(node: unknown, name: string): string | null {
  if (typeof node !== 'object' || node === null) {
    return null;
  }
  const raw = (node as Record<string, unknown>)[`@_${name}`];
  if (raw === undefined || raw === null) {
    return null;
  }
  const value = String(raw).trim();
  return value.length === 0 ? null : value;
}

/**
 * Parse a string into a finite number, returning `null` for missing /
 * non-numeric / `Infinity` / `NaN` inputs.
 */
function parseFloatOrNull(raw: string | null): number | null {
  if (raw === null) {
    return null;
  }
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : null;
}

const SAMPLE_CFDI_XML = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/3"
                  xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital"
                  Version="3.3"
                  Serie="A"
                  Folio="000123"
                  Fecha="2026-05-24T10:00:00"
                  Sello="MOCK_SELLO_BASE64=="
                  FormaPago="03"
                  NoCertificado="00001000000500000001"
                  SubTotal="100.00"
                  Moneda="MXN"
                  Total="116.00"
                  TipoDeComprobante="I"
                  MetodoPago="PUE"
                  LugarExpedicion="64000">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Proveedor Ejemplo SA de CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="MAR050101ABC" Nombre="Martinrea Mexico SA de CV" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87"
                   Descripcion="Sample widget" ValorUnitario="100.00" Importe="100.00"/>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="16.00"/>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital Version="1.1"
                             UUID="A1B2C3D4-E5F6-7890-ABCD-1234567890AB"
                             FechaTimbrado="2026-05-24T10:00:05"
                             SelloCFD="MOCK"
                             NoCertificadoSAT="00001000000400000001"
                             SelloSAT="MOCK"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

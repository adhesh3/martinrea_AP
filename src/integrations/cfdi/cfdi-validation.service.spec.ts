import type { Repository } from 'typeorm';

import type { AuditLogEntity } from '../entities/audit-log.entity';
import {
  CfdiParserService,
  type CfdiParseResult,
} from './cfdi-parser.service';
import { CfdiValidationService } from './cfdi-validation.service';
import {
  SatValidatorService,
  type SatVerifyResult,
} from './sat-validator.service';

interface ServiceHandles {
  service: CfdiValidationService;
  parser: jest.Mocked<Pick<CfdiParserService, 'readFromBlob' | 'parseAndValidate'>>;
  sat: jest.Mocked<Pick<SatValidatorService, 'verifyCfdi'>>;
  auditLogRepo: { insert: jest.Mock };
}

function buildService(options: {
  blobThrows?: Error;
  parseResult?: CfdiParseResult;
  satResult?: SatVerifyResult;
  auditInsertThrows?: Error;
}): ServiceHandles {
  const parser = {
    readFromBlob: jest.fn(),
    parseAndValidate: jest.fn(),
  };
  if (options.blobThrows) {
    parser.readFromBlob.mockRejectedValue(options.blobThrows);
  } else {
    parser.readFromBlob.mockResolvedValue('<cfdi:Comprobante/>');
  }
  parser.parseAndValidate.mockReturnValue(
    options.parseResult ?? makeValidParseResult(),
  );

  const sat = {
    verifyCfdi: jest.fn(),
  };
  sat.verifyCfdi.mockResolvedValue(
    options.satResult ?? {
      satStatus: 'Vigente',
      rawResponse: '<r/>',
      error: null,
    },
  );

  const auditLogRepo = {
    insert: jest.fn(),
  };
  if (options.auditInsertThrows) {
    auditLogRepo.insert.mockRejectedValue(options.auditInsertThrows);
  } else {
    auditLogRepo.insert.mockResolvedValue({ identifiers: [{ id: 'audit-1' }] });
  }

  const service = new CfdiValidationService(
    parser as unknown as CfdiParserService,
    sat as unknown as SatValidatorService,
    auditLogRepo as unknown as Repository<AuditLogEntity>,
  );
  return { service, parser, sat, auditLogRepo };
}

function makeValidParseResult(): CfdiParseResult {
  return {
    isValid: true,
    fields: {
      uuid: '11111111-2222-3333-4444-555555555555',
      emisorRfc: 'AAA010101AAA',
      receptorRfc: 'BBB020202BBB',
      sello: 'sello-x',
      noCertificado: '00001000000500000000',
      total: 1500.0,
      iva: 240.0,
    },
    violations: [],
  };
}

describe('CfdiValidationService.validateInvoice', () => {
  it('11. blob read fails → returns cfdiValid:false and writes one audit row', async () => {
    const { service, parser, sat, auditLogRepo } = buildService({
      blobThrows: new Error('blob not found'),
    });

    const result = await service.validateInvoice('inv-1', 'cfdi/inv-1.xml');

    expect(result.cfdiValid).toBe(false);
    expect(result.violationReason).toContain('Failed to read CFDI from blob');
    expect(result.satStatus).toBeNull();
    // SAT must never be called when we couldn't even read the XML.
    expect(sat.verifyCfdi).not.toHaveBeenCalled();
    expect(parser.parseAndValidate).not.toHaveBeenCalled();
    // Per Roshni's spec, every validation attempt — including failed ones —
    // must produce exactly one audit_logs row.
    expect(auditLogRepo.insert).toHaveBeenCalledTimes(1);
  });

  it('12. structural validation fails → cfdiValid:false, does NOT call SAT', async () => {
    const { service, sat } = buildService({
      parseResult: {
        isValid: false,
        fields: { uuid: null, emisorRfc: null, receptorRfc: null, sello: null, noCertificado: null, total: null, iva: null },
        violations: ['Missing UUID', 'Invalid total format'],
      },
    });

    const result = await service.validateInvoice('inv-2', 'cfdi/inv-2.xml');

    expect(result.cfdiValid).toBe(false);
    expect(result.violationReason).toContain('Missing UUID');
    expect(result.satStatus).toBeNull();
    expect(sat.verifyCfdi).not.toHaveBeenCalled();
  });

  it('13. SAT returns Vigente → cfdiValid:true, violationReason:null', async () => {
    const { service } = buildService({
      satResult: { satStatus: 'Vigente', rawResponse: '<r/>', error: null },
    });

    const result = await service.validateInvoice('inv-3', 'cfdi/inv-3.xml');

    expect(result.cfdiValid).toBe(true);
    expect(result.violationReason).toBeNull();
    expect(result.satStatus).toBe('Vigente');
  });

  it('14. SAT returns Cancelado → cfdiValid:false, violationReason mentions cancelled', async () => {
    const { service } = buildService({
      satResult: { satStatus: 'Cancelado', rawResponse: '<r/>', error: null },
    });

    const result = await service.validateInvoice('inv-4', 'cfdi/inv-4.xml');

    expect(result.cfdiValid).toBe(false);
    expect(result.violationReason).toBe('Invoice cancelled in SAT system');
    expect(result.satStatus).toBe('Cancelado');
  });

  it('15. SAT returns No Encontrado → cfdiValid:false', async () => {
    const { service } = buildService({
      satResult: { satStatus: 'No Encontrado', rawResponse: '<r/>', error: null },
    });

    const result = await service.validateInvoice('inv-5', 'cfdi/inv-5.xml');

    expect(result.cfdiValid).toBe(false);
    expect(result.violationReason).toBe(
      'Invoice UUID not found in SAT registry',
    );
    expect(result.satStatus).toBe('No Encontrado');
  });

  it('16. SAT_UNAVAILABLE → cfdiValid:true (graceful degradation rule)', async () => {
    // Critical compliance rule: when SAT itself is unreachable, do NOT block
    // the invoice. Finance ops process it with `satStatus: SAT_UNAVAILABLE`
    // and the Sprint-3 revalidation cron rechecks it later.
    const { service } = buildService({
      satResult: {
        satStatus: 'SAT_UNAVAILABLE',
        rawResponse: null,
        error: 'ECONNRESET',
      },
    });

    const result = await service.validateInvoice('inv-6', 'cfdi/inv-6.xml');

    expect(result.cfdiValid).toBe(true);
    expect(result.violationReason).toBeNull();
    expect(result.satStatus).toBe('SAT_UNAVAILABLE');
  });

  it('17. writeAuditLog failure is swallowed — result still returned to caller', async () => {
    // Spec: audit_logs writes are isolated from the validation result. A DB
    // outage on audit_logs must never block the verdict reaching the caller;
    // the Sprint-3 reconciliation job will replay the missing audit row.
    const { service, auditLogRepo } = buildService({
      auditInsertThrows: new Error('audit_logs table locked'),
    });

    const result = await service.validateInvoice('inv-7', 'cfdi/inv-7.xml');

    expect(result.cfdiValid).toBe(true);
    expect(result.satStatus).toBe('Vigente');
    expect(auditLogRepo.insert).toHaveBeenCalledTimes(1);
  });
});

describe('CfdiValidationService.revalidateInvoice', () => {
  it('18. skips blob read + XML parse, calls SAT directly', async () => {
    const { service, parser, sat } = buildService({
      satResult: { satStatus: 'Cancelado', rawResponse: '<r/>', error: null },
    });

    const result = await service.revalidateInvoice(
      'inv-8',
      '11111111-2222-3333-4444-555555555555',
      'AAA010101AAA',
      'BBB020202BBB',
      1500,
    );

    // Revalidation reuses fields stored from the original validation pass —
    // it must not re-parse the XML.
    expect(parser.readFromBlob).not.toHaveBeenCalled();
    expect(parser.parseAndValidate).not.toHaveBeenCalled();
    expect(sat.verifyCfdi).toHaveBeenCalledTimes(1);
    // SAT is called with the exact provided fields, total formatted to 2dp.
    expect(sat.verifyCfdi).toHaveBeenCalledWith({
      uuid: '11111111-2222-3333-4444-555555555555',
      emisorRfc: 'AAA010101AAA',
      receptorRfc: 'BBB020202BBB',
      total: '1500.00',
    });
    expect(result.cfdiValid).toBe(false);
    expect(result.satStatus).toBe('Cancelado');
  });
});

import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

/**
 * Status reported by SAT (Servicio de Administración Tributaria) for a CFDI,
 * plus a fallback marker for when SAT itself was unreachable.
 *
 * Values match the strings SAT returns verbatim ("Vigente", "Cancelado",
 * "No Encontrado"); `SAT_UNAVAILABLE` is platform-internal and is used when
 * the SAT lookup failed for transport reasons (timeout, 5xx, circuit open).
 */
export type SatStatus =
  | 'Vigente'
  | 'Cancelado'
  | 'No Encontrado'
  | 'SAT_UNAVAILABLE';

/**
 * Aggregate result of validating a CFDI XML document end-to-end.
 *
 * Produced by `CfdiValidationService` after combining structural parsing with
 * the SAT lookup. Exactly one of these is persisted per invoice and used by
 * the AP matching engine to decide whether the invoice is allowed to flow
 * through to three-way matching.
 */
export class CfdiValidationResultDto {
  /** Internal id of the AP invoice this result belongs to. */
  @IsString()
  invoiceId!: string;

  /** UUID assigned by SAT to the CFDI ("TimbreFiscalDigital"). */
  @IsUUID()
  uuid!: string;

  /** Issuer (supplier) RFC. */
  @IsString()
  emisorRfc!: string;

  /** Receiver (Martinrea entity) RFC. */
  @IsString()
  receptorRfc!: string;

  /** Total amount declared on the CFDI. */
  @IsNumber()
  total!: number;

  /** IVA (Mexican VAT) component of `total`. */
  @IsNumber()
  iva!: number;

  /** Digital seal ("sello") string from the CFDI. */
  @IsString()
  sello!: string;

  /** Certificate number ("noCertificado") of the issuer's certificate. */
  @IsString()
  noCertificado!: string;

  /**
   * Final verdict from the platform.
   *
   *   `true`  — structural checks passed AND `satStatus` is `Vigente`
   *             OR `SAT_UNAVAILABLE` (graceful-degradation rule, see
   *             `CfdiValidationService.validateInvoice`).
   *   `false` — structural checks failed, or SAT returned `Cancelado`
   *             / `No Encontrado`.
   */
  @IsBoolean()
  cfdiValid!: boolean;

  /**
   * Human-readable explanation of why the CFDI was rejected. `null` when
   * `cfdiValid` is `true`.
   */
  @IsOptional()
  @IsString()
  violationReason!: string | null;

  /**
   * SAT verdict, or `null` when SAT was never queried (e.g. the CFDI failed
   * structural validation up front, or blob retrieval failed).
   */
  @IsOptional()
  @IsIn(['Vigente', 'Cancelado', 'No Encontrado', 'SAT_UNAVAILABLE'])
  satStatus!: SatStatus | null;

  /** Wall-clock time at which validation was performed. */
  @Type(() => Date)
  @IsDate()
  validatedAt!: Date;
}

import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

/**
 * Lifecycle status of a supplier in the source ERP.
 */
export type SupplierStatus = 'ACTIVE' | 'INACTIVE';

/**
 * Canonical supplier representation used across the integrations module.
 *
 * `supplierCode` is the *normalised* unique key from Epicor:
 *   - In the US instances it is sourced from `VendorNum`.
 *   - In the Mexico instances it is sourced from `CodigoProveedor`.
 * Both are mapped onto this single field by the sync layer so downstream
 * consumers don't need to know which region the supplier originated from.
 */
export class SupplierDto {
  @IsUUID()
  supplierId!: string;

  @IsString()
  supplierCode!: string;

  @IsString()
  supplierName!: string;

  /** Tax registration number (RFC for MX, EIN for US, BN for CA). Nullable. */
  @IsOptional()
  @IsString()
  taxId!: string | null;

  /** ISO 3166-1 alpha-2 country code. */
  @IsString()
  country!: string;

  /** ISO 4217 currency code from the source ERP. */
  @IsString()
  currencyCode!: string;

  /** Free-text payment terms (e.g. "NET30"). Nullable. */
  @IsOptional()
  @IsString()
  payTerms!: string | null;

  @IsOptional()
  @IsString()
  addressLine1!: string | null;

  @IsOptional()
  @IsString()
  city!: string | null;

  @IsOptional()
  @IsString()
  stateProvince!: string | null;

  @IsIn(['ACTIVE', 'INACTIVE'])
  status!: SupplierStatus;

  /** Numeric Epicor instance id this supplier belongs to. */
  @IsInt()
  instanceId!: number;

  /** Wall-clock time the supplier was last refreshed from Epicor. */
  @Type(() => Date)
  @IsDate()
  lastSyncedAt!: Date;
}

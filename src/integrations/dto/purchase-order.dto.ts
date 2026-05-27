import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

/**
 * Single line on a Purchase Order.
 *
 * Modelled as an interface (not a class) per the integration spec — line-item
 * payloads are immutable transport objects and don't need their own
 * class-validator decorators. The parent `PurchaseOrderDto` validates the
 * outer array shape via `@IsArray()`; per-field validation of line items is
 * handled by the mappers in the sync layer.
 */
export interface PurchaseOrderLineItem {
  lineNum: number;
  description: string;
  orderedQty: number;
  unitPrice: number;
  lineTotal: number;
  unitOfMeasure: string;
}

/**
 * Lifecycle status of a Purchase Order in the source ERP.
 *
 *   OPEN    — fully receivable / invoiceable.
 *   CLOSED  — fully received and invoiced (or manually closed).
 *   PARTIAL — at least one line has been received but the PO isn't closed.
 */
export type PurchaseOrderStatus = 'OPEN' | 'CLOSED' | 'PARTIAL';

/**
 * Canonical Purchase Order representation used across the integrations module.
 */
export class PurchaseOrderDto {
  @IsUUID()
  poId!: string;

  @IsString()
  poNumber!: string;

  /** Foreign key to `SupplierDto.supplierId`. */
  @IsUUID()
  supplierId!: string;

  /** Denormalised supplier code (Epicor VendorNum / CodigoProveedor). */
  @IsString()
  supplierCode!: string;

  /** Denormalised supplier name for display in lists / matching UIs. */
  @IsString()
  supplierName!: string;

  @IsArray()
  lineItems!: PurchaseOrderLineItem[];

  @IsNumber()
  totalAmount!: number;

  /** Need-by date from the source PO header. Nullable. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  needByDate!: Date | null;

  /** ISO 4217 currency code. */
  @IsString()
  currency!: string;

  @IsIn(['OPEN', 'CLOSED', 'PARTIAL'])
  status!: PurchaseOrderStatus;

  /** Plant / site code that owns the PO. */
  @IsString()
  plantId!: string;

  /** Numeric Epicor instance id this PO belongs to. */
  @IsInt()
  instanceId!: number;

  /** Wall-clock time the PO was last refreshed from Epicor. */
  @Type(() => Date)
  @IsDate()
  lastSyncedAt!: Date;
}

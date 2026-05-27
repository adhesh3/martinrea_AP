import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
} from 'class-validator';

/**
 * Single line on a Goods Receipt.
 *
 * Modelled as an interface (not a class) per the integration spec.
 */
export interface GoodsReceiptLineItem {
  lineNum: number;
  description: string;
  orderedQty: number;
  receivedQty: number;
  unitPrice: number;
  lineTotal: number;
}

/**
 * Source format the goods-receipt was originally pulled from.
 *
 * Different regions ship receipts in different shapes (US plants stream
 * structured rows over ODBC; Mexico plants drop CSV / XML files over SFTP),
 * and downstream consumers occasionally need to know which adapter produced
 * the canonical `GoodsReceiptDto`.
 */
export type GoodsReceiptSource = 'US' | 'MEXICO';

/**
 * Canonical Goods Receipt representation used across the integrations module.
 *
 * Goods receipts are the link between a PO and an AP invoice — three-way
 * matching (PO ↔ Receipt ↔ Invoice) is one of the core flows of the platform.
 */
export class GoodsReceiptDto {
  @IsUUID()
  grId!: string;

  @IsString()
  grNumber!: string;

  /** PO number this receipt was booked against (matches `PurchaseOrderDto.poNumber`). */
  @IsString()
  poNumber!: string;

  @IsArray()
  lineItems!: GoodsReceiptLineItem[];

  @Type(() => Date)
  @IsDate()
  receivedDate!: Date;

  /** Numeric Epicor instance id this receipt belongs to. */
  @IsInt()
  instanceId!: number;

  /** Which regional format was the original data in. */
  @IsIn(['US', 'MEXICO'])
  rawSource!: GoodsReceiptSource;
}

import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/**
 * Query parameters for `GET /api/integrations/goods-receipts`.
 *
 * Validated globally by NestJS's `ValidationPipe` (see `main.ts`) — the
 * `enableImplicitConversion` option there is what coerces `instance="1"`
 * from the URL into a real `number` before this DTO is even hit.
 */
export class GetGoodsReceiptsQueryDto {
  /** PO number to look up receipts for (e.g. `PO-001`). */
  @IsString()
  @IsNotEmpty()
  po!: string;

  /** Numeric Epicor instance id (1..44). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(44)
  instance!: number;

  /** 1-indexed page number. Default: 1. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /** Page size. Default: 50. Max: 50. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 50;
}

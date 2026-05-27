import {
  Controller,
  Get,
  HttpStatus,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { GetGoodsReceiptsQueryDto } from '../dto/get-goods-receipts-query.dto';
import { GoodsReceiptDto } from '../dto/goods-receipt.dto';
import {
  EPICOR_TIMEOUT_ERROR,
  GoodsReceiptsService,
} from './goods-receipts.service';

interface GoodsReceiptsResponseEnvelope {
  success: boolean;
  data: GoodsReceiptDto[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
  error?: string;
}

/**
 * Live goods-receipts API for the matching workbench (INT-03).
 *
 * Hard SLA: 3 seconds end-to-end. If Epicor is slow, we return 503 instead
 * of leaving the workbench spinning.
 */
@ApiTags('Goods Receipts — INT-03')
@Controller('api/integrations')
export class GoodsReceiptsController {
  constructor(private readonly grService: GoodsReceiptsService) {}

  @Get('goods-receipts')
  @ApiOperation({
    summary: 'Fetch goods receipts for a PO from a specific Epicor instance',
    description:
      'Live read from Epicor. Normalises the regional format (US vs. Mexico) ' +
      'into a single canonical shape. Times out after 3 seconds.',
  })
  @ApiQuery({ name: 'po', required: true, type: String })
  @ApiQuery({ name: 'instance', required: true, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({
    description: 'Paginated list of goods receipts.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No goods receipts found for the given PO/instance.',
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'Epicor instance did not respond within 3 seconds.',
  })
  async listGoodsReceipts(
    @Query() query: GetGoodsReceiptsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<GoodsReceiptsResponseEnvelope> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    try {
      const result = await this.grService.getGoodsReceipts(
        query.po,
        query.instance,
        page,
        limit,
      );

      if (result.total === 0) {
        res.status(HttpStatus.NOT_FOUND);
        return {
          success: false,
          error: `No goods receipts found for PO ${query.po} on instance ${query.instance}`,
          data: [],
        };
      }

      return {
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page,
          limit,
          hasMore: result.hasMore,
        },
      };
    } catch (err) {
      if ((err as Error).message === EPICOR_TIMEOUT_ERROR) {
        res.status(HttpStatus.SERVICE_UNAVAILABLE);
        return {
          success: false,
          error: `Epicor instance ${query.instance} did not respond within 3 seconds. Please retry.`,
          data: [],
        };
      }
      throw err;
    }
  }
}

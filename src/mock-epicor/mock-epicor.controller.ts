import {
  BadRequestException,
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

import { MockEpicorService } from './mock-epicor.service';

const WARNING =
  'MOCK DATA — Not real Epicor CMS. For demo and testing only.';

type MockRegion = 'US' | 'MEXICO' | 'CANADA';

class MockListQuery {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(44)
  instance!: number;

  @IsString()
  @IsIn(['US', 'MEXICO', 'CANADA'])
  region!: MockRegion;
}

class MockGoodsReceiptsQuery {
  @IsString()
  @IsNotEmpty()
  po!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(44)
  instance!: number;

  @IsOptional()
  @IsString()
  @IsIn(['US', 'MEXICO', 'CANADA'])
  region?: MockRegion;
}

interface MockEnvelope<T> {
  _warning: string;
  _instance: number;
  _region: MockRegion;
  data: T;
}

/**
 * Read-only HTTP view onto `MockEpicorService` so a developer can poke at
 * the simulated Epicor data without going through the integrations layer.
 *
 * Every response is wrapped in an envelope that loudly flags it as fake —
 * easy to spot when scrolling through Swagger or browser tabs.
 */
@ApiTags('Mock Epicor CMS — Demo Only')
@Controller('mock-epicor')
export class MockEpicorController {
  constructor(private readonly mock: MockEpicorService) {}

  @Get('suppliers')
  @ApiOperation({
    summary:
      'List active suppliers in their native Epicor shape (US / MX / CA).',
  })
  @ApiQuery({ name: 'instance', required: true, type: Number })
  @ApiQuery({ name: 'region', required: true, enum: ['US', 'MEXICO', 'CANADA'] })
  listSuppliers(@Query() q: MockListQuery): MockEnvelope<unknown[]> {
    let data: unknown[];
    if (q.region === 'MEXICO') {
      data = this.mock.getMexicoSuppliers(q.instance);
    } else if (q.region === 'CANADA') {
      data = this.mock.getCanadaSuppliers(q.instance);
    } else {
      data = this.mock.getUSSuppliers(q.instance);
    }
    return this.envelope(q.instance, q.region, data);
  }

  @Get('purchase-orders')
  @ApiOperation({
    summary: 'List open purchase orders in their native Epicor shape.',
  })
  @ApiQuery({ name: 'instance', required: true, type: Number })
  @ApiQuery({ name: 'region', required: true, enum: ['US', 'MEXICO', 'CANADA'] })
  listPurchaseOrders(@Query() q: MockListQuery): MockEnvelope<unknown[]> {
    let data: unknown[];
    if (q.region === 'MEXICO') {
      data = this.mock.getMexicoOpenPOs(q.instance);
    } else if (q.region === 'CANADA') {
      data = this.mock.getCanadaOpenPOs(q.instance);
    } else {
      data = this.mock.getUSOpenPOs(q.instance);
    }
    return this.envelope(q.instance, q.region, data);
  }

  @Get('goods-receipts')
  @ApiOperation({
    summary:
      'List goods receipts for a PO. Region is auto-detected from the PO number ' +
      '(`OC-...` → MEXICO, `PO-CA-...` → CANADA, otherwise US) unless explicitly passed.',
  })
  @ApiQuery({ name: 'po', required: true, type: String })
  @ApiQuery({ name: 'instance', required: true, type: Number })
  @ApiQuery({
    name: 'region',
    required: false,
    enum: ['US', 'MEXICO', 'CANADA'],
  })
  async listGoodsReceipts(
    @Query() q: MockGoodsReceiptsQuery,
  ): Promise<MockEnvelope<unknown[]>> {
    const region = q.region ?? detectRegionFromPo(q.po);
    let data: unknown[];
    if (region === 'MEXICO') {
      data = await this.mock.getMexicoGoodsReceipts(q.po, q.instance);
    } else if (region === 'CANADA') {
      data = await this.mock.getCanadaGoodsReceipts(q.po, q.instance);
    } else if (region === 'US') {
      data = await this.mock.getUSGoodsReceipts(q.po, q.instance);
    } else {
      throw new BadRequestException(
        'region must be one of "US", "MEXICO" or "CANADA"',
      );
    }
    return this.envelope(q.instance, region, data);
  }

  private envelope<T>(
    instance: number,
    region: MockRegion,
    data: T,
  ): MockEnvelope<T> {
    return {
      _warning: WARNING,
      _instance: instance,
      _region: region,
      data,
    };
  }
}

/**
 * Best-effort region guess from a PO number prefix, used only when the caller
 * doesn't pass an explicit `region`:
 *   - `OC-...`    → MEXICO (Orden de Compra)
 *   - `PO-CA-...` → CANADA
 *   - otherwise   → US
 */
function detectRegionFromPo(po: string): MockRegion {
  if (po.startsWith('OC-')) return 'MEXICO';
  if (po.startsWith('PO-CA-')) return 'CANADA';
  return 'US';
}

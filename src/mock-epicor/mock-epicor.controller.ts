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

class MockListQuery {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(44)
  instance!: number;

  @IsString()
  @IsIn(['US', 'MEXICO'])
  region!: 'US' | 'MEXICO';
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
  @IsIn(['US', 'MEXICO'])
  region?: 'US' | 'MEXICO';
}

interface MockEnvelope<T> {
  _warning: string;
  _instance: number;
  _region: 'US' | 'MEXICO';
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
    summary: 'List active suppliers in their native Epicor shape (US or MX).',
  })
  @ApiQuery({ name: 'instance', required: true, type: Number })
  @ApiQuery({ name: 'region', required: true, enum: ['US', 'MEXICO'] })
  listSuppliers(@Query() q: MockListQuery): MockEnvelope<unknown[]> {
    const data =
      q.region === 'US'
        ? this.mock.getUSSuppliers(q.instance)
        : this.mock.getMexicoSuppliers(q.instance);
    return this.envelope(q.instance, q.region, data);
  }

  @Get('purchase-orders')
  @ApiOperation({
    summary: 'List open purchase orders in their native Epicor shape.',
  })
  @ApiQuery({ name: 'instance', required: true, type: Number })
  @ApiQuery({ name: 'region', required: true, enum: ['US', 'MEXICO'] })
  listPurchaseOrders(@Query() q: MockListQuery): MockEnvelope<unknown[]> {
    const data =
      q.region === 'US'
        ? this.mock.getUSOpenPOs(q.instance)
        : this.mock.getMexicoOpenPOs(q.instance);
    return this.envelope(q.instance, q.region, data);
  }

  @Get('goods-receipts')
  @ApiOperation({
    summary:
      'List goods receipts for a PO. Region is auto-detected from the PO number ' +
      '(`OC-...` → MEXICO, otherwise US) unless explicitly passed.',
  })
  @ApiQuery({ name: 'po', required: true, type: String })
  @ApiQuery({ name: 'instance', required: true, type: Number })
  @ApiQuery({
    name: 'region',
    required: false,
    enum: ['US', 'MEXICO'],
  })
  async listGoodsReceipts(
    @Query() q: MockGoodsReceiptsQuery,
  ): Promise<MockEnvelope<unknown[]>> {
    const region = q.region ?? (q.po.startsWith('OC-') ? 'MEXICO' : 'US');
    if (region !== 'US' && region !== 'MEXICO') {
      throw new BadRequestException(
        'region must be either "US" or "MEXICO"',
      );
    }
    const data =
      region === 'US'
        ? await this.mock.getUSGoodsReceipts(q.po, q.instance)
        : await this.mock.getMexicoGoodsReceipts(q.po, q.instance);
    return this.envelope(q.instance, region, data);
  }

  private envelope<T>(
    instance: number,
    region: 'US' | 'MEXICO',
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

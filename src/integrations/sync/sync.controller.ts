import { Body, Controller, Logger, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { CfdiValidationService } from '../cfdi/cfdi-validation.service';
import { CfdiValidationResultDto } from '../dto/cfdi-validation-result.dto';
import { EpicorSyncService } from './epicor-sync.service';

class TriggerSyncBodyDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(44)
  instanceId?: number;
}

class ValidateCfdiBodyDto {
  @IsString()
  @IsNotEmpty()
  invoiceId!: string;

  @IsString()
  @IsNotEmpty()
  blobPath!: string;
}

interface TriggerSyncResponse {
  message: string;
  instanceId: number | 'ALL';
  triggeredAt: string;
}

/**
 * Admin endpoints for manually kicking off integrations work.
 *
 * TODO: Add @UseGuards(JwtAuthGuard) before go-live.
 *       Currently unprotected for dev / testing only.
 */
@ApiTags('Sync — INT-01/02', 'CFDI — INT-04')
@Controller('api/integrations')
export class SyncController {
  private readonly logger = new Logger(SyncController.name);

  constructor(
    private readonly epicorSync: EpicorSyncService,
    private readonly cfdiValidation: CfdiValidationService,
  ) {}

  @Post('sync/trigger')
  @ApiOperation({
    summary: 'Trigger a sync run on demand (full or single-instance).',
    description:
      'Returns immediately after kicking off the sync — actual work runs ' +
      'in the background. Watch /api/integrations/health and the ' +
      'sync_run_logs table for progress.',
  })
  async triggerSync(
    @Body() body: TriggerSyncBodyDto,
  ): Promise<TriggerSyncResponse> {
    const triggeredAt = new Date().toISOString();
    const target: number | 'ALL' = body.instanceId ?? 'ALL';

    // Fire-and-forget — don't block the HTTP response on a 44-instance fan-out.
    void this.epicorSync.triggerManualSync(body.instanceId).catch((err) => {
      this.logger.error(
        `Manual sync failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
    });

    this.logger.log(
      `Manual sync triggered: target=${target} at=${triggeredAt}`,
    );
    return {
      message: 'Sync triggered',
      instanceId: target,
      triggeredAt,
    };
  }

  @Post('cfdi/validate')
  @ApiOperation({
    summary: 'Validate a Mexico CFDI invoice end-to-end (parse + SAT lookup).',
  })
  async validateCfdi(
    @Body() body: ValidateCfdiBodyDto,
  ): Promise<CfdiValidationResultDto> {
    return this.cfdiValidation.validateInvoice(body.invoiceId, body.blobPath);
  }
}

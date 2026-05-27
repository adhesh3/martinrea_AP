import { Controller, Get, Logger } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { getInstanceById } from '../config/epicor-instances.config';
import { SatValidatorService } from '../cfdi/sat-validator.service';
import {
  SyncRunLogEntity,
  SyncStatus,
} from '../entities/sync-run-log.entity';

interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  checks: {
    sat_reachable: boolean;
    epicor_us_sample: boolean;
    epicor_mexico_sample: boolean;
    last_sync_status: {
      instanceId: number;
      status: string;
      completedAt: Date;
    } | null;
  };
}

/**
 * Health check for the integrations module.
 *
 * Exposes a single GET that returns the reachability of each external
 * dependency plus the most-recent sync run. Used by uptime monitors,
 * deployment smoke tests, and the on-call runbook.
 */
@ApiTags('Health')
@Controller('api/integrations/health')
export class IntegrationsHealthController {
  private readonly logger = new Logger(IntegrationsHealthController.name);

  constructor(
    private readonly satValidator: SatValidatorService,
    @InjectRepository(SyncRunLogEntity)
    private readonly syncLogRepo: Repository<SyncRunLogEntity>,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Health check for SAT, sample Epicor instances, and last sync.',
  })
  async check(): Promise<HealthCheckResponse> {
    const [satReachable, epicorUs, epicorMx, lastSync] = await Promise.all([
      this.checkSat(),
      this.pingEpicor(1),
      this.pingEpicor(21),
      this.fetchLastSync(),
    ]);

    let status: HealthCheckResponse['status'];
    if (!satReachable && !epicorUs && !epicorMx) {
      status = 'down';
    } else if (!satReachable || !epicorUs || !epicorMx) {
      status = 'degraded';
    } else {
      status = 'ok';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      checks: {
        sat_reachable: satReachable,
        epicor_us_sample: epicorUs,
        epicor_mexico_sample: epicorMx,
        last_sync_status: lastSync,
      },
    };
  }

  private async checkSat(): Promise<boolean> {
    try {
      return await this.satValidator.isSatReachable();
    } catch (err) {
      this.logger.warn(`SAT reachability probe threw: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Ping a sample Epicor instance.
   *
   * TODO: Replace with a real Epicor ping once credentials + VPN are
   * available. For now we just verify that the instance is configured and
   * marked active — the structural prerequisite for any real ping.
   */
  private async pingEpicor(instanceId: number): Promise<boolean> {
    const instance = getInstanceById(instanceId);
    return Boolean(instance?.isActive);
  }

  private async fetchLastSync(): Promise<
    HealthCheckResponse['checks']['last_sync_status']
  > {
    try {
      const row = await this.syncLogRepo.findOne({
        where: [
          { status: SyncStatus.SUCCESS },
          { status: SyncStatus.PARTIAL },
          { status: SyncStatus.FAILED },
        ],
        order: { startedAt: 'DESC' },
      });
      if (!row || !row.completedAt) return null;
      return {
        instanceId: row.instanceId,
        status: row.status,
        completedAt: row.completedAt,
      };
    } catch (err) {
      this.logger.warn(
        `Could not read last sync row: ${(err as Error).message}`,
      );
      return null;
    }
  }
}

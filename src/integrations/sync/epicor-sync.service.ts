import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import pLimit from 'p-limit';
import { LessThan, Repository } from 'typeorm';

import {
  EpicorInstance,
  getActiveInstances,
  getInstanceById,
} from '../config/epicor-instances.config';
import {
  SyncJobType,
  SyncRunLogEntity,
  SyncStatus,
} from '../entities/sync-run-log.entity';
import { PurchaseOrdersSyncService } from './purchase-orders-sync.service';
import {
  SuppliersSyncService,
  SupplierSyncCounts,
} from './suppliers-sync.service';
import { PurchaseOrderSyncCounts } from './purchase-orders-sync.service';

const ZERO_COUNTS: SupplierSyncCounts & PurchaseOrderSyncCounts = {
  fetched: 0,
  inserted: 0,
  updated: 0,
  failed: 0,
};

const STALE_RUNNING_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours
const DEFAULT_CONCURRENCY = 8;
const FAILED_INSTANCES_CRITICAL_THRESHOLD = 10;

export interface SyncInstanceResult {
  instanceId: number;
  suppliersResult: SupplierSyncCounts;
  posResult: PurchaseOrderSyncCounts;
  overallStatus: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  error?: string;
}

/**
 * Nightly sync orchestrator (INT-01 + INT-02).
 *
 * One row per sub-job is written to `sync_run_logs` (e.g. running both
 * suppliers + POs for instance 1 produces two rows). The orchestrator-level
 * verdict (`SUCCESS` / `PARTIAL` / `FAILED`) is computed in memory from those
 * two rows and returned as `SyncInstanceResult`. This keeps the
 * `SyncJobType` enum tight (one of the three sub-jobs only) while still
 * giving each sub-job its own counters in the database.
 */
@Injectable()
export class EpicorSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EpicorSyncService.name);
  private readonly concurrency =
    Number(process.env.MAX_CONCURRENT_EPICOR_CONNECTIONS) ||
    DEFAULT_CONCURRENCY;

  constructor(
    @InjectRepository(SyncRunLogEntity)
    private readonly logRepo: Repository<SyncRunLogEntity>,
    private readonly suppliersSync: SuppliersSyncService,
    private readonly posSync: PurchaseOrdersSyncService,
    private readonly configService: ConfigService,
  ) {}

  // ── Lifecycle ───────────────────────────────────────────────────

  /**
   * On boot, mark any rows stuck in `RUNNING` for more than 2 hours as
   * `FAILED`. Prevents stale RUNNING rows if the previous server instance
   * was killed mid-sync.
   */
  async onApplicationBootstrap(): Promise<void> {
    const cutoff = new Date(Date.now() - STALE_RUNNING_THRESHOLD_MS);
    try {
      const result = await this.logRepo.update(
        { status: SyncStatus.RUNNING, startedAt: LessThan(cutoff) },
        {
          status: SyncStatus.FAILED,
          errorMessage:
            'Process terminated mid-sync — marked failed on restart',
          completedAt: new Date(),
        },
      );
      const affected = result.affected ?? 0;
      if (affected > 0) {
        this.logger.warn(
          `Reaped ${affected} stale RUNNING sync_run_logs row(s) on bootstrap.`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to reap stale RUNNING rows on bootstrap: ${(err as Error).message}`,
      );
    }
  }

  // ── Public API ──────────────────────────────────────────────────

  /**
   * Return the `completedAt` timestamp of the most recent SUCCESS row in
   * `sync_run_logs` for a given (instance, jobType). Used as the watermark
   * for incremental pulls — pass into `syncForInstance(instance, since)`.
   *
   * Returns `null` when no SUCCESS row exists yet (first run, or every
   * prior run failed / partial). Callers treat `null` as "full pull",
   * which is the safe default for both first runs and post-failure
   * recovery — re-pulling everything is wider than necessary but never
   * misses records.
   */
  async getLastSuccessfulRunTime(
    instanceId: number,
    jobType: SyncJobType,
  ): Promise<Date | null> {
    const row = await this.logRepo.findOne({
      where: { instanceId, jobType, status: SyncStatus.SUCCESS },
      order: { completedAt: 'DESC' },
    });
    return row?.completedAt ?? null;
  }

  /**
   * Run suppliers + POs sync for one Epicor instance.
   *
   * Each sub-job gets its own `sync_run_logs` row. The combined outcome is
   * returned in memory via `SyncInstanceResult.overallStatus`. Each sub-job
   * is run incrementally when a prior SUCCESS row exists for the same
   * (instance, jobType) — only records modified after that watermark are
   * pulled. First runs fall back to a full pull.
   */
  async runSyncForInstance(
    instance: EpicorInstance,
    triggeredBy: string = 'CRON',
  ): Promise<SyncInstanceResult> {
    const instanceId = instance.instanceId;

    // Suppliers
    const suppliersSince = await this.getLastSuccessfulRunTime(
      instanceId,
      SyncJobType.SUPPLIERS,
    );
    const suppliersLog = await this.openRun(
      instanceId,
      SyncJobType.SUPPLIERS,
      triggeredBy,
    );
    let suppliersResult: SupplierSyncCounts;
    let suppliersOk = true;
    let suppliersError: string | undefined;
    try {
      suppliersResult = await this.suppliersSync.syncForInstance(
        instance,
        suppliersSince,
      );
      await this.closeRun(
        suppliersLog.id,
        suppliersResult.failed === 0 ? SyncStatus.SUCCESS : SyncStatus.PARTIAL,
        suppliersResult,
        suppliersResult.failed === 0
          ? null
          : `${suppliersResult.failed} record(s) failed to normalise`,
      );
      if (suppliersResult.failed > 0) suppliersOk = false;
    } catch (err) {
      suppliersOk = false;
      suppliersError = (err as Error).message;
      suppliersResult = { ...ZERO_COUNTS };
      await this.closeRun(
        suppliersLog.id,
        SyncStatus.FAILED,
        suppliersResult,
        suppliersError,
      );
    }

    // POs
    const posSince = await this.getLastSuccessfulRunTime(
      instanceId,
      SyncJobType.PURCHASE_ORDERS,
    );
    const posLog = await this.openRun(
      instanceId,
      SyncJobType.PURCHASE_ORDERS,
      triggeredBy,
    );
    let posResult: PurchaseOrderSyncCounts;
    let posOk = true;
    let posError: string | undefined;
    try {
      posResult = await this.posSync.syncForInstance(instance, posSince);
      await this.closeRun(
        posLog.id,
        posResult.failed === 0 ? SyncStatus.SUCCESS : SyncStatus.PARTIAL,
        posResult,
        posResult.failed === 0
          ? null
          : `${posResult.failed} record(s) failed to normalise`,
      );
      if (posResult.failed > 0) posOk = false;
    } catch (err) {
      posOk = false;
      posError = (err as Error).message;
      posResult = { ...ZERO_COUNTS };
      await this.closeRun(
        posLog.id,
        SyncStatus.FAILED,
        posResult,
        posError,
      );
    }

    // Compose the overall verdict.
    let overallStatus: SyncInstanceResult['overallStatus'];
    if (suppliersOk && posOk) overallStatus = 'SUCCESS';
    else if (!suppliersOk && !posOk) overallStatus = 'FAILED';
    else overallStatus = 'PARTIAL';

    const combinedError = [suppliersError, posError]
      .filter(Boolean)
      .join('; ');

    if (overallStatus !== 'SUCCESS') {
      await this.sendAlert(
        instance,
        combinedError || 'one or more sub-jobs reported normalisation failures',
        overallStatus === 'FAILED' ? 'CRITICAL' : 'WARNING',
      );
    }

    return {
      instanceId,
      suppliersResult,
      posResult,
      overallStatus,
      error: combinedError || undefined,
    };
  }

  /**
   * Fan-out across all active instances, capped to `MAX_CONCURRENT_EPICOR_CONNECTIONS`
   * via `p-limit`. Uses `Promise.allSettled` so a single instance failing never
   * blocks the rest.
   */
  async runFullSync(triggeredBy: string = 'CRON'): Promise<void> {
    const instances = getActiveInstances();
    const total = instances.length;
    this.logger.log(
      `Starting full sync over ${total} active instance(s) at concurrency=${this.concurrency} (triggeredBy=${triggeredBy}).`,
    );

    const limit = pLimit(this.concurrency);
    const results = await Promise.allSettled(
      instances.map((instance) =>
        limit(() => this.runSyncForInstance(instance, triggeredBy)),
      ),
    );

    const succeeded: number[] = [];
    const failed: { instanceId: number; reason: string }[] = [];
    results.forEach((r, idx) => {
      const instance = instances[idx];
      if (r.status === 'fulfilled') {
        if (r.value.overallStatus === 'SUCCESS') {
          succeeded.push(instance.instanceId);
        } else {
          failed.push({
            instanceId: instance.instanceId,
            reason: r.value.error ?? r.value.overallStatus,
          });
        }
      } else {
        failed.push({
          instanceId: instance.instanceId,
          reason: (r.reason as Error)?.message ?? 'unknown',
        });
      }
    });

    this.logger.log(
      `Full sync complete: ${succeeded.length}/${total} succeeded, ${failed.length} failed. ` +
        (failed.length > 0
          ? `Failed instanceIds: ${failed.map((f) => f.instanceId).join(', ')}`
          : ''),
    );

    if (failed.length > FAILED_INSTANCES_CRITICAL_THRESHOLD) {
      await this.sendAlert(
        null,
        `Full sync had ${failed.length} failed instances (>${FAILED_INSTANCES_CRITICAL_THRESHOLD} threshold). ` +
          `Failed instanceIds: ${failed.map((f) => f.instanceId).join(', ')}`,
        'CRITICAL',
      );
    }
  }

  /**
   * Cron entrypoint — runs at 02:00 server time (UTC) daily.
   *
   * TODO Sprint 2: Replace with per-timezone scheduling.
   *   Option 1: dynamic cron per instance timezone (one job per plant).
   *   Option 2: queue-based fan-out (BullMQ) with delayed jobs scheduled
   *             for each plant's local 02:00.
   * Current: all instances kicked off at 02:00 UTC together.
   */
  @Cron('0 2 * * *')
  async handleCron(): Promise<void> {
    this.logger.log('Cron tick (0 2 * * *) — triggering nightly full sync.');
    await this.runFullSync('CRON');
  }

  /**
   * Manual sync trigger from the admin endpoint.
   * If `instanceId` is provided, only that instance is synced.
   */
  async triggerManualSync(instanceId?: number): Promise<void> {
    if (instanceId === undefined || instanceId === null) {
      this.logger.log('Manual trigger: full sync.');
      await this.runFullSync('MANUAL');
      return;
    }
    const instance = getInstanceById(instanceId);
    if (!instance) {
      throw new Error(`Unknown instanceId ${instanceId}`);
    }
    this.logger.log(
      `Manual trigger: instance ${instanceId} (${instance.plantName}).`,
    );
    await this.runSyncForInstance(instance, 'MANUAL');
  }

  // ── Internals ───────────────────────────────────────────────────

  private async openRun(
    instanceId: number,
    jobType: SyncJobType,
    triggeredBy: string,
  ): Promise<SyncRunLogEntity> {
    const row = this.logRepo.create({
      instanceId,
      jobType,
      status: SyncStatus.RUNNING,
      startedAt: new Date(),
      triggeredBy,
    });
    return this.logRepo.save(row);
  }

  private async closeRun(
    id: string,
    status: SyncStatus,
    counts: { fetched: number; inserted: number; updated: number; failed: number },
    errorMessage: string | null,
  ): Promise<void> {
    await this.logRepo.update(id, {
      status,
      completedAt: new Date(),
      recordsFetched: counts.fetched,
      recordsInserted: counts.inserted,
      recordsUpdated: counts.updated,
      recordsFailed: counts.failed,
      errorMessage,
    });
  }

  /**
   * Surface a sync failure to the team.
   *
   * Fan-out:
   *   - Slack: posts a Block-Kit message to `SLACK_WEBHOOK_URL` if set.
   *   - Datadog: posts an event to the standard Events API if
   *     `DATADOG_API_KEY` is set. Tagged with instance / plant / region /
   *     level so Datadog Monitors can route critical alerts to PagerDuty.
   *
   * Both channels degrade independently — if Slack is down, Datadog still
   * fires; if both are unset (dev / staging), the alert falls back to a
   * `[ALERT MOCK]` console line so the developer sees what would have gone
   * out. Errors thrown by either client are caught and logged; an alert
   * delivery failure must never propagate up and abort the sync itself.
   */
  private async sendAlert(
    instance: EpicorInstance | null,
    error: string,
    level: 'WARNING' | 'CRITICAL' = 'WARNING',
  ): Promise<void> {
    const target = instance
      ? `Instance ${instance.instanceId} (${instance.plantName})`
      : 'Full sync';
    const timestamp = new Date().toISOString();

    const slackUrl = this.configService.get<string>('SLACK_WEBHOOK_URL');
    const datadogKey = this.configService.get<string>('DATADOG_API_KEY');
    const slackEnabled = isPlaceholder(slackUrl) === false;
    const datadogEnabled = isPlaceholder(datadogKey) === false;

    if (!slackEnabled && !datadogEnabled) {
      // eslint-disable-next-line no-console
      console.log(
        `[ALERT MOCK][${level}] ${target} sync failed: ${error} ` +
          `(no SLACK_WEBHOOK_URL / DATADOG_API_KEY configured)`,
      );
      return;
    }

    const tasks: Promise<unknown>[] = [];

    if (slackEnabled) {
      tasks.push(this.postToSlack(slackUrl!, instance, target, error, level, timestamp));
    }
    if (datadogEnabled) {
      tasks.push(this.postToDatadog(datadogKey!, instance, target, error, level));
    }

    // `allSettled` so one channel's failure never blocks the other.
    await Promise.allSettled(tasks);
  }

  private async postToSlack(
    webhookUrl: string,
    instance: EpicorInstance | null,
    target: string,
    error: string,
    level: 'WARNING' | 'CRITICAL',
    timestamp: string,
  ): Promise<void> {
    const region = instance?.region ?? 'N/A';
    const body = {
      text: `[${level}] Epicor sync failed — ${target}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text:
              `*${level}: ${target}*\n` +
              `*Region:* ${region}\n` +
              `*Error:* ${error}\n` +
              `*Time:* ${timestamp}`,
          },
        },
      ],
    };
    try {
      await axios.post(webhookUrl, body, { timeout: 5000 });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[ALERT] Slack delivery failed: ${message}`);
    }
  }

  private async postToDatadog(
    apiKey: string,
    instance: EpicorInstance | null,
    target: string,
    error: string,
    level: 'WARNING' | 'CRITICAL',
  ): Promise<void> {
    const tags = [
      `level:${level.toLowerCase()}`,
      `service:martinrea-ap-integrations`,
    ];
    if (instance) {
      tags.push(
        `instance:${instance.instanceId}`,
        `plant:${instance.plantName}`,
        `region:${instance.region}`,
      );
    }
    try {
      await axios.post(
        'https://api.datadoghq.com/api/v1/events',
        {
          title: `Epicor sync ${level} — ${target}`,
          text: error,
          tags,
          alert_type: level === 'CRITICAL' ? 'error' : 'warning',
          source_type_name: 'epicor-sync',
        },
        {
          headers: { 'DD-API-KEY': apiKey },
          timeout: 5000,
        },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[ALERT] Datadog delivery failed: ${message}`);
    }
  }
}

/**
 * The codebase convention for "unset" secrets is the literal string
 * `PLACEHOLDER` in `.env`. Treat both unset and PLACEHOLDER as disabled so
 * dev / staging never accidentally fires alerts at real channels.
 */
function isPlaceholder(value: string | undefined): boolean {
  return !value || value === 'PLACEHOLDER';
}

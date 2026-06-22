import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CfdiParserService } from './cfdi/cfdi-parser.service';
import { CfdiValidationService } from './cfdi/cfdi-validation.service';
import { SatValidatorService } from './cfdi/sat-validator.service';
import { AuditLogEntity } from './entities/audit-log.entity';
import { GoodsReceiptEntity } from './entities/goods-receipt.entity';
import { PurchaseOrderEntity } from './entities/purchase-order.entity';
import { SupplierEntity } from './entities/supplier.entity';
import { SyncRunLogEntity } from './entities/sync-run-log.entity';
import { GoodsReceiptsController } from './goods-receipts/goods-receipts.controller';
import { GoodsReceiptsService } from './goods-receipts/goods-receipts.service';
import { IntegrationsHealthController } from './health/integrations-health.controller';
import { EpicorSyncService } from './sync/epicor-sync.service';
import { PurchaseOrdersSyncService } from './sync/purchase-orders-sync.service';
import { SuppliersSyncService } from './sync/suppliers-sync.service';
import { SyncController } from './sync/sync.controller';

/**
 * External Integrations module for the Martinrea AP Automation Platform.
 *
 * Bundles three product features:
 *   - INT-01 / INT-02 — nightly Epicor sync of suppliers and POs (across the
 *                       44 plant instances).
 *   - INT-03         — live, real-time goods-receipt API for the matching
 *                       workbench.
 *   - INT-04         — Mexico CFDI validation (parse + SAT lookup) for AP
 *                       invoices originating from Mexican suppliers.
 *
 * Roles:
 *   - `EpicorSyncService` is the orchestrator and the only thing scheduling
 *     work. It depends on `SuppliersSyncService` + `PurchaseOrdersSyncService`
 *     for the actual data pulls.
 *   - `GoodsReceiptsService` serves live reads — no scheduling.
 *   - `CfdiValidationService` is the public face of CFDI validation and
 *     composes `CfdiParserService` + `SatValidatorService`.
 *
 * See `src/integrations/README.md` for endpoint catalogue, env-var pattern,
 * and the list of items pending Roshni / Martinrea before go-live.
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      SyncRunLogEntity,
      SupplierEntity,
      PurchaseOrderEntity,
      GoodsReceiptEntity,
      // Placeholder until Roshni ships the canonical `audit_logs` entity.
      // See `entities/audit-log.entity.ts` for the swap procedure.
      AuditLogEntity,
    ]),
    // `MockEpicorModule` is registered globally by AppModule in non-production
    // envs (see `app.module.ts`). The sync + goods-receipts services here
    // inject `MockEpicorService` directly; the global registration lets that
    // work without an explicit import. In production, the module is never
    // loaded — DI will fail loud at startup until a real Epicor adapter is
    // bound, which is the intended defensive behaviour.
  ],
  controllers: [
    GoodsReceiptsController,
    SyncController,
    IntegrationsHealthController,
  ],
  providers: [
    EpicorSyncService,
    SuppliersSyncService,
    PurchaseOrdersSyncService,
    GoodsReceiptsService,
    CfdiParserService,
    SatValidatorService,
    CfdiValidationService,
  ],
  exports: [
    EpicorSyncService,
    SuppliersSyncService,
    PurchaseOrdersSyncService,
    GoodsReceiptsService,
    CfdiParserService,
    SatValidatorService,
    CfdiValidationService,
  ],
})
export class IntegrationsModule {}

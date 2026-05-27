# External Integrations Module

NestJS module that owns all outbound traffic from the Martinrea AP Automation
Platform to third-party systems. Wired up in `integrations.module.ts` and
imported once at the application root via `IntegrationsModule`.

## What this module does

- **Epicor sync.** Pulls supplier master data and purchase orders from
  Martinrea's 44 plant Epicor CMS instances (20 US + 14 Mexico + 10 Canada)
  on a nightly cron, plus on-demand from admin tooling. Per-instance failures
  are isolated via `Promise.allSettled` so one bad plant never blocks the
  other 43. Every run is persisted to `sync_run_logs` (RUNNING → SUCCESS /
  PARTIAL / FAILED) with counters and an error message.
- **CFDI validation (INT-04).** For Mexico-region invoices, reads the CFDI
  XML from blob storage, parses it with `fast-xml-parser`, validates the
  mandatory SAT fields (UUID + RFCs + Sello + NoCertificado + Total + IVA),
  calls SAT's "Consulta CFDI" SOAP service to verify the UUID is real and
  active, and writes a structured result + audit-log entry. The SAT call has
  retry-with-backoff over up to 3 attempts (immediate, +1s, +2s) and degrades
  to `SAT_UNAVAILABLE` rather than throwing. Per business rule, an
  `SAT_UNAVAILABLE` outcome surfaces as `cfdiValid: true` (graceful
  degradation — needs sign-off from Martinrea compliance).
- **Goods-receipts read API.** Live REST endpoint backing Yash's three-way
  matching workbench. Hides the difference between US (English-field) and
  Mexico (Spanish-field) Epicor outputs behind one canonical
  `GoodsReceiptDto`.

## Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET`  | `/api/integrations/goods-receipts` | Paginated, US/Mexico-normalised goods receipts for a `(po, instance)` pair. Query params: `po` (required), `instance` (required, numeric), `page` (default `1`), `limit` (default `50`, max `50`). Returns `{ success, data, pagination: { total, page, limit, hasMore } }`. `404` when no receipts exist. `503` when Epicor exceeds the 3-second SLA. |
| `POST` | `/api/integrations/sync/trigger` | Manually trigger a sync run. Body: `{ instanceId?: number }` — omit for full sync, supply `1..44` to run a single plant. Returns `{ message, instanceId, triggeredAt }`. |
| `POST` | `/api/integrations/cfdi/validate` | Run end-to-end CFDI validation (parse + SAT lookup) for a single invoice. Body: `{ invoiceId, blobPath }`. Returns a `CfdiValidationResultDto`. |
| `GET`  | `/api/integrations/health` | Health probe. Returns `{ status, timestamp, checks: { sat_reachable, epicor_us_sample, epicor_mexico_sample, last_sync_status } }`. |

Scheduled / programmatic surfaces:

- `EpicorSyncService.handleCron()` — `@Cron('0 2 * * *')`, triggered
  automatically once `IntegrationsModule` is loaded.
- `EpicorSyncService.triggerManualSync(instanceId?)` — service method
  underlying the manual-trigger endpoint above.
- `CfdiValidationService.validateInvoice(invoiceId, blobPath)` — service
  method called from the AP invoice ingestion pipeline (and the
  `cfdi/validate` endpoint).

## Environment variables

All values below are placeholder names — real values come from the platform's
secrets manager once Martinrea finalises credentials.

### Per-instance Epicor credentials

For each of the 44 instances declared in `config/epicor-instances.config.ts`,
set the following five vars where `<N>` is the numeric `instanceId` (`1`–`44`):

```
EPICOR_INSTANCE_<N>_HOST
EPICOR_INSTANCE_<N>_PORT
EPICOR_INSTANCE_<N>_USER
EPICOR_INSTANCE_<N>_PASSWORD
EPICOR_INSTANCE_<N>_DATABASE
```

Examples (one per region):

```
# US — Hopkinsville, KY Plant 1 (ODBC, port 1433)
EPICOR_INSTANCE_1_HOST=epicor-hopkinsville-1.martinrea.local
EPICOR_INSTANCE_1_PORT=1433
EPICOR_INSTANCE_1_USER=mr_ap_svc
EPICOR_INSTANCE_1_PASSWORD=__from_secrets_manager__
EPICOR_INSTANCE_1_DATABASE=EpicorERP_HOPK1

# Mexico — Ramos Arizpe Plant 1 (SFTP, port 22)
EPICOR_INSTANCE_21_HOST=epicor-ramos-arizpe-1.martinrea.local
EPICOR_INSTANCE_21_PORT=22
EPICOR_INSTANCE_21_USER=mr_ap_sftp
EPICOR_INSTANCE_21_PASSWORD=__from_secrets_manager__
EPICOR_INSTANCE_21_DATABASE=EpicorERP_RAM1

# Canada — Vaughan HQ (SFTP, port 22)
EPICOR_INSTANCE_35_HOST=epicor-vaughan.martinrea.local
EPICOR_INSTANCE_35_PORT=22
EPICOR_INSTANCE_35_USER=mr_ap_sftp
EPICOR_INSTANCE_35_PASSWORD=__from_secrets_manager__
EPICOR_INSTANCE_35_DATABASE=EpicorERP_VGHN
```

### SAT (CFDI verification)

```
SAT_ENDPOINT_URL=https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc
SAT_TIMEOUT_MS=8000
SAT_RETRY_DELAYS_MS=1000,2000,4000
```

All three are read by `SatValidatorService` via `ConfigService` at boot
and fall back to the documented defaults (`8000ms`, `[1000,2000]`) when
unset. Swap `SAT_ENDPOINT_URL` to an authorised PAC URL if direct SAT
access is ever revoked — no code change required.

### Blob storage (CFDI XML payloads)

```
AZURE_BLOB_CONNECTION_STRING=__from_secrets_manager__
AZURE_BLOB_CONTAINER_CFDI=invoices-cfdi-raw
```

### Alerting (sync failures)

```
SLACK_WEBHOOK_URL=__from_secrets_manager__
DATADOG_API_KEY=__from_secrets_manager__
```

`EpicorSyncService.sendAlert(...)` fans out to both Slack (Block-Kit
message) and Datadog (Events API with `instance` / `plant` / `region` /
`level` tags) whenever either secret is set and not the literal string
`PLACEHOLDER`. When both are absent, alerts degrade to a `[ALERT MOCK]`
log line so dev / staging never accidentally pages oncall.

### MockEpicor feature flag

```
NODE_ENV=development   # set to 'production' to exclude MockEpicorModule
```

`MockEpicorModule` is registered globally by `AppModule` only when
`NODE_ENV !== 'production'`. In production, the DI container will fail
loud at boot if any service still depends on `MockEpicorService` — that
is the intended defensive behaviour until a real Epicor adapter ships.

## Database schema status

V1–V5 SQL migrations for the tables this module owns
(`suppliers`, `purchase_orders`, `purchase_order_lines`, `goods_receipts`,
`goods_receipt_lines`) are in `migrations/`. They:

- assume Roshni's core tables (`invoices`, `users`) already exist for the
  FKs referenced from `goods_receipts` and `audit_logs`,
- use `snake_case` columns consistent with `SnakeNamingStrategy` in
  `app.module.ts` (entity property `supplierCode` maps to column
  `supplier_code` automatically — do **not** add explicit `name:`
  overrides on entities unless you also update the migration),
- are pending Roshni's review before merge into the canonical migration
  stream.

## Pending from Roshni

- **`audit_logs` canonical entity.** This module ships a placeholder at
  `entities/audit-log.entity.ts`; `CfdiValidationService.writeAuditLog`
  inserts one row per validation event against it. Swap the placeholder
  for Roshni's authoritative entity when ready — the field names already
  match her spec (`actionType`, `invoiceId`, `oldValue` / `newValue` jsonb,
  `notes`).
- **V1–V5 review + merge** into the canonical migration stream.
- **Decision on migration tooling**: keep raw SQL files (current shape)
  vs. promote to TypeORM `MigrationInterface` classes so they ship via
  `typeorm migration:run`.
- **`CfdiParserService.readFromBlob(...)` real Azure Blob client** —
  currently returns a hardcoded sample CFDI XML so the rest of the
  validation pipeline can be exercised end-to-end.

## Pending from Martinrea

- **Real Epicor credentials** for all 44 plant instances (host, port,
  database, user, password). Every entry in `config/epicor-instances.config.ts`
  is currently `PLACEHOLDER_HOST` / `PLACEHOLDER_USER` / `PLACEHOLDER_PASS`.
- **Plant-side VPN access** so the platform host can reach the on-prem
  Epicor CMS servers. Without this, every `runSyncForInstance(...)` call
  will fail with a connection error and trip the alert sink for all 44
  plants nightly.
- **SAT compliance signoff** confirming the `SAT_UNAVAILABLE` → "do not
  block the invoice" business rule documented at the top of
  `cfdi/cfdi-validation.service.ts`. If compliance wants invoices held
  until SAT confirms `Vigente`, the verdict in `buildSatLookupResult` is
  a one-line change.
- **Per-timezone scheduling preference.** The current `@Cron('0 2 * * *')`
  runs at 02:00 *server* time across all 44 plants. Sprint 2 will move to
  per-plant local time using the `timezone` field on each instance config
  (see `handleCron` JSDoc for the two viable approaches: dynamic per-instance
  cron, or queue-based fan-out via BullMQ).
- **Production blob path convention** for incoming CFDI XML files (which
  container, what naming pattern, retention policy) so
  `CfdiValidationService.validateInvoice(invoiceId, blobPath)` can be
  invoked by the upstream invoice intake pipeline.
- **Real Canadian Epicor data + onboarding.** All 10 Canada instances
  return empty arrays today (`Canada region not yet wired` log line in
  the sync services).

## Local setup

```bash
# 1. Start Postgres (matches .env defaults: db=martinrea_ap user=postgres)
docker compose up postgres -d

# 2. Install deps
npm install

# 3. Run the app (auto-creates dev schema via TypeORM synchronize)
npm run start:dev

# 4. Run the test suite
npm test    # 44 tests across 7 suites
```

If Docker isn't available, the equivalent Homebrew path is:

```bash
brew install postgresql@15
brew services start postgresql@15
createdb martinrea_ap
```

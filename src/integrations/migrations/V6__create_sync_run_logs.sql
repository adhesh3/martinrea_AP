-- Owner: Manav (Integration Engineer)
-- Written by: EpicorSyncService (sync orchestrator)
-- Coordinate with Roshni before running
--
-- Writers: `EpicorSyncService.runSyncForInstance(...)` inserts one row per
--   sub-job at RUNNING, then updates to SUCCESS / PARTIAL / FAILED at
--   completion. The bootstrap "stranded-row reaper" also marks pre-existing
--   RUNNING rows as FAILED when the app restarts after a crash.
-- Readers: `EpicorSyncService.getLastSuccessfulRunTime(...)` queries this
--   table for the incremental-sync watermark per (instance_id, job_type).
--   Ops dashboards read it for "did last night's cron succeed?" answers.
--
-- Dependencies:
--   None. This table is independent of V1–V5: instance_id is stored as a
--   plain integer (1..44), not as an FK, so the log survives even if all
--   other integration tables are dropped. Run in any order relative to the
--   rest of the V-series.

BEGIN;

-- ENUM types backing the `job_type` and `status` columns. Wrapped in DO
-- blocks because `CREATE TYPE` does not support `IF NOT EXISTS` until
-- Postgres 16; this lets the migration be re-run safely on older clusters.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_job_type') THEN
        CREATE TYPE sync_job_type AS ENUM (
            'SUPPLIERS',
            'PURCHASE_ORDERS',
            'GOODS_RECEIPTS'
        );
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_status') THEN
        CREATE TYPE sync_status AS ENUM (
            'RUNNING',
            'SUCCESS',
            'PARTIAL',
            'FAILED'
        );
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS sync_run_logs (
    id                UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id       INTEGER         NOT NULL,
    job_type          sync_job_type   NOT NULL,
    status            sync_status     NOT NULL DEFAULT 'RUNNING',
    started_at        TIMESTAMPTZ     NOT NULL,
    completed_at      TIMESTAMPTZ,
    records_fetched   INTEGER         NOT NULL DEFAULT 0,
    records_inserted  INTEGER         NOT NULL DEFAULT 0,
    records_updated   INTEGER         NOT NULL DEFAULT 0,
    records_failed    INTEGER         NOT NULL DEFAULT 0,
    error_message     VARCHAR(2000),
    triggered_by      VARCHAR(32)     NOT NULL DEFAULT 'CRON',
    created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_sync_run_logs_counts_nonneg CHECK (
        records_fetched  >= 0 AND
        records_inserted >= 0 AND
        records_updated  >= 0 AND
        records_failed   >= 0
    ),
    CONSTRAINT ck_sync_run_logs_completed_after_started CHECK (
        completed_at IS NULL OR completed_at >= started_at
    )
);

-- General-purpose composite — covers "show me runs for plant X, job Y,
-- ordered by start time" and the per-instance dashboard view.
CREATE INDEX IF NOT EXISTS idx_sync_run_logs_instance_job_started
    ON sync_run_logs (instance_id, job_type, started_at DESC);

-- Hot path: `getLastSuccessfulRunTime(instanceId, jobType)` filters to
-- `status = 'SUCCESS'` and orders by `completed_at DESC`. A partial index
-- keyed on completed_at makes that lookup index-only, which matters because
-- this query fires twice per instance per sync run (88x nightly).
CREATE INDEX IF NOT EXISTS idx_sync_run_logs_last_success
    ON sync_run_logs (instance_id, job_type, completed_at DESC)
    WHERE status = 'SUCCESS';

-- Bootstrap reaper: on startup the orchestrator scans for stranded RUNNING
-- rows left behind by a previous crash and marks them FAILED. The partial
-- index stays tiny (only currently-running rows are indexed) so this is a
-- cheap full-index scan rather than a sequential scan of the whole log.
CREATE INDEX IF NOT EXISTS idx_sync_run_logs_running
    ON sync_run_logs (started_at)
    WHERE status = 'RUNNING';

-- Failure forensics: "show me every FAILED run in the last 7 days across
-- all plants" is the most common ops query during an incident.
CREATE INDEX IF NOT EXISTS idx_sync_run_logs_failed
    ON sync_run_logs (started_at DESC)
    WHERE status = 'FAILED';

COMMENT ON TABLE  sync_run_logs IS
    'Append-mostly audit log of every Epicor sync sub-job run. One row per '
    '(instance_id, job_type) per run. Status transitions RUNNING → '
    'SUCCESS / PARTIAL / FAILED; rows are never deleted. Drives the '
    'incremental-sync watermark via getLastSuccessfulRunTime().';
COMMENT ON COLUMN sync_run_logs.instance_id      IS 'Epicor plant instance (1..44). Plain integer, not an FK — see file header.';
COMMENT ON COLUMN sync_run_logs.job_type         IS 'Which sub-job this row tracks: SUPPLIERS / PURCHASE_ORDERS / GOODS_RECEIPTS.';
COMMENT ON COLUMN sync_run_logs.status           IS 'Lifecycle state. Starts at RUNNING; resolved to SUCCESS / PARTIAL / FAILED on completion.';
COMMENT ON COLUMN sync_run_logs.started_at       IS 'Wall-clock at the moment the sub-job started (insert time).';
COMMENT ON COLUMN sync_run_logs.completed_at     IS 'Wall-clock at the moment the sub-job resolved. NULL while RUNNING.';
COMMENT ON COLUMN sync_run_logs.records_fetched  IS 'Rows pulled from Epicor for this run.';
COMMENT ON COLUMN sync_run_logs.records_inserted IS 'New rows written to the target table during this run.';
COMMENT ON COLUMN sync_run_logs.records_updated  IS 'Existing rows updated via ON CONFLICT during this run.';
COMMENT ON COLUMN sync_run_logs.records_failed   IS 'Rows that failed normalisation; orchestrator continues past these.';
COMMENT ON COLUMN sync_run_logs.error_message    IS 'Summary of the terminal error if status = FAILED / PARTIAL. NULL on SUCCESS.';
COMMENT ON COLUMN sync_run_logs.triggered_by     IS 'How the run started: CRON (nightly cron) or MANUAL (admin trigger endpoint).';

COMMIT;

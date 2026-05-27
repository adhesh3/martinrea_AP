/**
 * Static configuration for Martinrea's 44 Epicor plant instances.
 *
 * The credentials in this file are placeholders — the real per-instance
 * host/user/password values will come from environment variables
 * (`EPICOR_INSTANCE_<N>_HOST`, etc.) once Martinrea provides VPN access.
 * Until then, services depend on this metadata only for region-aware
 * routing and connection-type selection.
 */

export type EpicorRegion = 'US' | 'MEXICO' | 'CANADA';
export type EpicorConnectionType = 'sftp' | 'odbc';

export interface EpicorInstance {
  instanceId: number;
  plantName: string;
  region: EpicorRegion;
  connectionType: EpicorConnectionType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  /** IANA timezone — drives per-plant 2-AM-local cron once Sprint 2 lands. */
  timezone: string;
  isActive: boolean;
}

const PLACEHOLDER_USER = 'PLACEHOLDER_USER';
const PLACEHOLDER_PASS = 'PLACEHOLDER_PASS';

/** Build a placeholder instance with sensible per-region defaults. */
function makeInstance(args: {
  instanceId: number;
  plantName: string;
  region: EpicorRegion;
  connectionType: EpicorConnectionType;
  timezone: string;
}): EpicorInstance {
  const { instanceId, region, connectionType } = args;
  return {
    ...args,
    host: `PLACEHOLDER_HOST_${instanceId}`,
    port: connectionType === 'odbc' ? 1433 : 22,
    database:
      connectionType === 'odbc'
        ? `epicor_${region.toLowerCase()}_${instanceId}`
        : `/exports/epicor/${region.toLowerCase()}/${instanceId}`,
    username: PLACEHOLDER_USER,
    password: PLACEHOLDER_PASS,
    isActive: true,
  };
}

// ─── 20 US plants (instanceId 1..20) ─────────────────────────────
const usTimezones = ['America/Detroit', 'America/Chicago'] as const;
const US_INSTANCES: EpicorInstance[] = Array.from({ length: 20 }, (_, i) => {
  const id = i + 1;
  const tz = usTimezones[i % usTimezones.length];
  const tzShort = tz === 'America/Detroit' ? 'Detroit' : 'Chicago';
  return makeInstance({
    instanceId: id,
    plantName: `${tzShort}-Plant-${id}`,
    region: 'US',
    connectionType: 'odbc',
    timezone: tz,
  });
});

// ─── 14 Mexico plants (instanceId 21..34) ────────────────────────
const MX_INSTANCES: EpicorInstance[] = Array.from({ length: 14 }, (_, i) => {
  const id = 21 + i;
  return makeInstance({
    instanceId: id,
    plantName: `Monterrey-Plant-${i + 1}`,
    region: 'MEXICO',
    // Alternate sftp / odbc across the 14 MX plants
    connectionType: i % 2 === 0 ? 'sftp' : 'odbc',
    timezone: 'America/Monterrey',
  });
});

// ─── 10 Canada plants (instanceId 35..44) ────────────────────────
const CA_INSTANCES: EpicorInstance[] = Array.from({ length: 10 }, (_, i) => {
  const id = 35 + i;
  return makeInstance({
    instanceId: id,
    plantName: `Toronto-Plant-${i + 1}`,
    region: 'CANADA',
    connectionType: 'sftp',
    timezone: 'America/Toronto',
  });
});

export const EPICOR_INSTANCES: EpicorInstance[] = [
  ...US_INSTANCES,
  ...MX_INSTANCES,
  ...CA_INSTANCES,
];

// ─── Helpers ─────────────────────────────────────────────────────

export function getInstanceById(
  instanceId: number,
): EpicorInstance | undefined {
  return EPICOR_INSTANCES.find((i) => i.instanceId === instanceId);
}

export function getInstancesByRegion(region: string): EpicorInstance[] {
  return EPICOR_INSTANCES.filter((i) => i.region === region);
}

export function getActiveInstances(): EpicorInstance[] {
  return EPICOR_INSTANCES.filter((i) => i.isActive);
}

export default EPICOR_INSTANCES;

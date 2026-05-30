import {
  evaluateLicense,
  type FeatureId,
  type LicenseDecision,
  type LicenseRecord,
  type LicenseStatus,
  type PlanId,
  resolveEntitlements,
} from '@arre/shared';
import type { Env } from '../env.js';

interface LicenseRow {
  id: string;
  org_id: string;
  status: string;
  plan_id: string;
  entitlement_overrides: string | null; // JSON map FeatureId -> bool
  period_ends_at: number | null;
  trial_ends_at: number | null;
  grace_period_seconds: number;
  kill_switch: number;
  bound_domain: string | null;
  cache_ttl_seconds: number;
}

const KILL_SWITCH_KV_PREFIX = 'kill:'; // kill:<licenseId> => "1" when killed
const DECISION_KV_PREFIX = 'decision:'; // decision:<licenseId> => cached LicenseDecision

/**
 * Load a license row from D1 and build the shared LicenseRecord.
 * Returns null when the license/store does not exist.
 */
export async function loadLicenseRecord(
  env: Env,
  licenseId: string,
): Promise<{ record: LicenseRecord; orgId: string } | null> {
  const row = await env.DB.prepare(
    `SELECT id, org_id, status, plan_id, entitlement_overrides, period_ends_at,
            trial_ends_at, grace_period_seconds, kill_switch, bound_domain, cache_ttl_seconds
       FROM licenses WHERE id = ?1`,
  )
    .bind(licenseId)
    .first<LicenseRow>();

  if (!row) return null;

  // The KV kill-switch flag is the fast path admins can flip to stop a site in
  // seconds, independent of the (slower-changing) D1 row.
  const kvKill = await env.LICENSE_KV.get(KILL_SWITCH_KV_PREFIX + licenseId);
  const killSwitch = row.kill_switch === 1 || kvKill === '1';

  const overrides = row.entitlement_overrides
    ? (JSON.parse(row.entitlement_overrides) as Partial<Record<FeatureId, boolean>>)
    : undefined;
  const entitlements = [
    ...resolveEntitlements(row.plan_id as PlanId, overrides),
  ];

  const record: LicenseRecord = {
    status: row.status as LicenseStatus,
    planId: row.plan_id as PlanId,
    entitlements,
    periodEndsAt: row.period_ends_at,
    trialEndsAt: row.trial_ends_at,
    gracePeriodSeconds: row.grace_period_seconds,
    killSwitch,
    boundDomain: row.bound_domain,
    cacheTtlSeconds: row.cache_ttl_seconds,
  };

  return { record, orgId: row.org_id };
}

/**
 * Authoritative validation used by the plugin's /plugin/license/validate call.
 * Computes the decision and caches it in KV for its TTL so repeated validations
 * are cheap. The kill switch is checked on the read path above, so flipping it
 * takes effect within the (short) inactive-decision TTL even if a positive
 * decision was cached.
 */
export async function validateLicense(
  env: Env,
  licenseId: string,
): Promise<LicenseDecision | null> {
  const loaded = await loadLicenseRecord(env, licenseId);
  if (!loaded) return null;

  const decision = evaluateLicense(loaded.record);

  await env.LICENSE_KV.put(
    DECISION_KV_PREFIX + licenseId,
    JSON.stringify(decision),
    { expirationTtl: Math.max(decision.cacheTtlSeconds, 60) },
  );

  return decision;
}

/** Read a cached decision without recomputing (used by hot read paths). */
export async function getCachedDecision(
  env: Env,
  licenseId: string,
): Promise<LicenseDecision | null> {
  const raw = await env.LICENSE_KV.get(DECISION_KV_PREFIX + licenseId);
  return raw ? (JSON.parse(raw) as LicenseDecision) : null;
}

/** Super-admin emergency kill switch: stop a site within seconds. */
export async function setKillSwitch(
  env: Env,
  licenseId: string,
  killed: boolean,
): Promise<void> {
  await env.DB.prepare(`UPDATE licenses SET kill_switch = ?2, updated_at = ?3 WHERE id = ?1`)
    .bind(licenseId, killed ? 1 : 0, Date.now())
    .run();

  if (killed) {
    await env.LICENSE_KV.put(KILL_SWITCH_KV_PREFIX + licenseId, '1', {
      expirationTtl: 60 * 60 * 24,
    });
  } else {
    await env.LICENSE_KV.delete(KILL_SWITCH_KV_PREFIX + licenseId);
  }
  // Invalidate any cached positive decision immediately.
  await env.LICENSE_KV.delete(DECISION_KV_PREFIX + licenseId);
}

/** Update license status (from billing webhooks or admin actions) + invalidate cache. */
export async function setLicenseStatus(
  env: Env,
  licenseId: string,
  status: LicenseStatus,
  periodEndsAt?: number | null,
): Promise<void> {
  if (periodEndsAt === undefined) {
    await env.DB.prepare(`UPDATE licenses SET status = ?2, updated_at = ?3 WHERE id = ?1`)
      .bind(licenseId, status, Date.now())
      .run();
  } else {
    await env.DB.prepare(
      `UPDATE licenses SET status = ?2, period_ends_at = ?3, updated_at = ?4 WHERE id = ?1`,
    )
      .bind(licenseId, status, periodEndsAt, Date.now())
      .run();
  }
  await env.LICENSE_KV.delete(DECISION_KV_PREFIX + licenseId);
}

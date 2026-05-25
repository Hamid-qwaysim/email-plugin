import type { FeatureId } from './features.js';
import type { PlanId } from './plans.js';

/**
 * Subscription/license lifecycle status. This drives the single most important
 * business rule in the product: whether premium functionality runs at all.
 */
export const LICENSE_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'admin_suspended',
  'expired_trial',
  'revoked',
] as const;
export type LicenseStatus = (typeof LICENSE_STATUSES)[number];

/**
 * Statuses under which premium features are allowed to run.
 * Everything else is a hard stop. `past_due` is allowed ONLY while inside the
 * configured grace period (see evaluateLicense).
 */
const RUNNING_STATUSES: ReadonlySet<LicenseStatus> = new Set<LicenseStatus>([
  'active',
  'trialing',
]);

export interface LicenseRecord {
  status: LicenseStatus;
  planId: PlanId;
  /** Effective entitlements after per-license overrides, as feature IDs. */
  entitlements: FeatureId[];
  /** Unix ms. When the current paid/trial period ends. */
  periodEndsAt: number | null;
  /** Unix ms. For trials/expired-trial handling. */
  trialEndsAt: number | null;
  /** Grace window (seconds) allowed after period end / past_due before hard stop. */
  gracePeriodSeconds: number;
  /**
   * Hard emergency kill switch set from the super-admin dashboard. When true,
   * the license is dead regardless of every other field. The plugin polls this
   * frequently (short KV TTL) so an admin can stop a site within seconds.
   */
  killSwitch: boolean;
  /** Domain this license is bound to, if any. */
  boundDomain: string | null;
  /** How long the plugin may cache a positive validation, in seconds. */
  cacheTtlSeconds: number;
}

export interface LicenseDecision {
  /** Whether premium functionality is allowed to run right now. */
  active: boolean;
  status: LicenseStatus;
  /** Human-readable reason, surfaced in the plugin admin and SaaS UI. */
  reason: string;
  /** Effective entitlements (empty when inactive). */
  entitlements: FeatureId[];
  /** Whether the merchant is inside a grace period (features still run). */
  inGracePeriod: boolean;
  /** Seconds the plugin may cache this decision before re-checking. */
  cacheTtlSeconds: number;
}

/**
 * The authoritative decision function. Runs identically on the server when
 * answering /plugin/license/validate. The plugin caches the RESULT (not the
 * inputs) for `cacheTtlSeconds`, but always re-checks the kill switch sooner.
 *
 * Ordering matters: the kill switch and explicit terminal states win before we
 * even look at the grace period.
 */
export function evaluateLicense(
  license: LicenseRecord,
  now: number = Date.now(),
): LicenseDecision {
  const base = {
    status: license.status,
    entitlements: [] as FeatureId[],
    inGracePeriod: false,
    // Inactive decisions get a short TTL so reactivation is picked up quickly.
    cacheTtlSeconds: Math.min(license.cacheTtlSeconds, 300),
  };

  if (license.killSwitch) {
    return { ...base, active: false, reason: 'License disabled by administrator (kill switch).' };
  }

  if (license.status === 'admin_suspended') {
    return { ...base, active: false, reason: 'Account suspended by administrator.' };
  }

  if (license.status === 'revoked') {
    return { ...base, active: false, reason: 'License has been revoked.' };
  }

  if (license.status === 'canceled' || license.status === 'unpaid') {
    return {
      ...base,
      active: false,
      reason: 'Subscription is not active. Premium features are paused.',
    };
  }

  if (license.status === 'expired_trial') {
    return { ...base, active: false, reason: 'Your free trial has ended.' };
  }

  // Trials: run until trialEndsAt.
  if (license.status === 'trialing') {
    if (license.trialEndsAt !== null && now > license.trialEndsAt) {
      return { ...base, active: false, reason: 'Your free trial has ended.' };
    }
    return {
      active: true,
      status: license.status,
      reason: 'Trial active.',
      entitlements: license.entitlements,
      inGracePeriod: false,
      cacheTtlSeconds: license.cacheTtlSeconds,
    };
  }

  // past_due: allowed only inside the grace window after periodEndsAt.
  if (license.status === 'past_due') {
    const graceEnds =
      (license.periodEndsAt ?? now) + license.gracePeriodSeconds * 1000;
    if (now <= graceEnds) {
      return {
        active: true,
        status: license.status,
        reason: 'Payment past due — running in grace period.',
        entitlements: license.entitlements,
        inGracePeriod: true,
        cacheTtlSeconds: base.cacheTtlSeconds,
      };
    }
    return {
      ...base,
      active: false,
      reason: 'Payment failed and the grace period has ended.',
    };
  }

  // active: still verify the period has not lapsed (defensive).
  if (RUNNING_STATUSES.has(license.status)) {
    if (license.periodEndsAt !== null && now > license.periodEndsAt) {
      const graceEnds = license.periodEndsAt + license.gracePeriodSeconds * 1000;
      if (now <= graceEnds) {
        return {
          active: true,
          status: license.status,
          reason: 'Subscription period ended — running in grace period.',
          entitlements: license.entitlements,
          inGracePeriod: true,
          cacheTtlSeconds: base.cacheTtlSeconds,
        };
      }
      return {
        ...base,
        active: false,
        reason: 'Subscription period has ended.',
      };
    }
    return {
      active: true,
      status: license.status,
      reason: 'Subscription active.',
      entitlements: license.entitlements,
      inGracePeriod: false,
      cacheTtlSeconds: license.cacheTtlSeconds,
    };
  }

  return { ...base, active: false, reason: 'License inactive.' };
}

/** Does an active decision grant a specific feature? */
export function decisionGrants(decision: LicenseDecision, feature: FeatureId): boolean {
  return decision.active && decision.entitlements.includes(feature);
}

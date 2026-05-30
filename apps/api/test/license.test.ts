import { describe, it, expect } from 'vitest';
import { evaluateLicense, type LicenseRecord } from '@arre/shared';

const base: LicenseRecord = {
  status: 'active',
  planId: 'pro',
  entitlements: ['visitor_tracking', 'ai_coupon_engine'],
  periodEndsAt: null,
  trialEndsAt: null,
  gracePeriodSeconds: 259200,
  killSwitch: false,
  boundDomain: 'shop.example.com',
  cacheTtlSeconds: 900,
};

describe('evaluateLicense', () => {
  it('active license runs and grants entitlements', () => {
    const d = evaluateLicense(base);
    expect(d.active).toBe(true);
    expect(d.entitlements).toContain('visitor_tracking');
    expect(d.cacheTtlSeconds).toBe(900);
  });

  it('kill switch overrides everything', () => {
    const d = evaluateLicense({ ...base, killSwitch: true });
    expect(d.active).toBe(false);
    expect(d.reason).toMatch(/kill switch/i);
    expect(d.entitlements).toEqual([]);
  });

  it('admin_suspended stops immediately', () => {
    const d = evaluateLicense({ ...base, status: 'admin_suspended' });
    expect(d.active).toBe(false);
  });

  it('canceled and unpaid stop premium features', () => {
    expect(evaluateLicense({ ...base, status: 'canceled' }).active).toBe(false);
    expect(evaluateLicense({ ...base, status: 'unpaid' }).active).toBe(false);
  });

  it('trialing runs until trialEndsAt', () => {
    const now = 1_000_000;
    expect(evaluateLicense({ ...base, status: 'trialing', trialEndsAt: now + 1000 }, now).active).toBe(true);
    expect(evaluateLicense({ ...base, status: 'trialing', trialEndsAt: now - 1000 }, now).active).toBe(false);
  });

  it('past_due runs inside grace then stops', () => {
    const now = 5_000_000;
    const periodEndsAt = now - 1000;
    const inGrace = evaluateLicense({ ...base, status: 'past_due', periodEndsAt, gracePeriodSeconds: 10 }, now);
    expect(inGrace.active).toBe(true);
    expect(inGrace.inGracePeriod).toBe(true);

    const expired = evaluateLicense({ ...base, status: 'past_due', periodEndsAt: now - 999_999, gracePeriodSeconds: 10 }, now);
    expect(expired.active).toBe(false);
  });

  it('inactive decisions get a short cache TTL', () => {
    const d = evaluateLicense({ ...base, status: 'canceled' });
    expect(d.cacheTtlSeconds).toBeLessThanOrEqual(300);
  });
});

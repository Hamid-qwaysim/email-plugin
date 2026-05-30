import { intentBand } from '@arre/shared';
import type { Env } from './env.js';
import { planRecovery, dueStep } from './lib/recovery.js';
import type { CouponGuard } from './lib/coupon.js';
import { prefixedId, now } from './lib/ids.js';
import { getCachedDecision } from './lib/license.js';
import { promoteAbandonedCarts } from './lib/carts.js';

/**
 * Scheduled scan (Cron Trigger). Walks open abandoned carts, computes each
 * cart's recovery plan, and dispatches the next due step — respecting stop
 * conditions (purchased/empty cart, inactive license) and idempotency (a step
 * is sent at most once).
 */
interface ScanRow {
  ab_id: string;
  store_id: string;
  abandoned_at: number;
  recovery_sent_steps: string | null;
  cart_status: string;
  cart_total: number | null;
  value_cents: number | null;
  visitor_id: string | null;
  customer_id: string | null;
  license_id: string;
  intent_score: number | null;
  email: string | null;
}

const DEFAULT_GUARD: CouponGuard = {
  maxDiscountPct: 15,
  maxDiscountCents: 5000,
  minCartCents: 2000,
  abuseScore: 0,
};

export async function runRecoveryScan(env: Env, limit = 100): Promise<{ dispatched: number; promoted: number }> {
  // First promote idle open carts so they become eligible for recovery.
  const promoted = await promoteAbandonedCarts(env);

  const rows = await env.DB.prepare(
    `SELECT a.id AS ab_id, a.store_id, a.abandoned_at, a.recovery_sent_steps,
            a.value_cents, c.status AS cart_status, c.total_cents AS cart_total,
            c.visitor_id, c.customer_id, s.license_id,
            v.intent_score, cu.email
       FROM abandoned_carts a
       JOIN carts c   ON c.id = a.cart_id
       JOIN stores s  ON s.id = a.store_id
       LEFT JOIN visitors v  ON v.id = c.visitor_id
       LEFT JOIN customers cu ON cu.id = c.customer_id
      WHERE a.recovered_at IS NULL
        AND c.status = 'abandoned'
      ORDER BY a.abandoned_at ASC
      LIMIT ?1`,
  )
    .bind(limit)
    .all<ScanRow>();

  let dispatched = 0;

  for (const row of rows.results ?? []) {
    // Stop condition: license must be active for this store.
    const decision = await getCachedDecision(env, row.license_id);
    if (!decision?.active || !decision.entitlements.includes('abandoned_cart_recovery')) {
      continue;
    }

    const cartCents = row.cart_total ?? row.value_cents ?? 0;
    const sent: number[] = row.recovery_sent_steps ? (JSON.parse(row.recovery_sent_steps) as number[]) : [];

    const plan = planRecovery({
      intentBand: intentBand(row.intent_score ?? 0),
      cartCents,
      guard: DEFAULT_GUARD,
      isReturningAbandoner: sent.length > 0,
      hasEmail: !!row.email,
    });

    const step = dueStep(plan, row.abandoned_at, sent);
    if (!step) continue;

    // Only email is dispatched here; web_push requires a subscription record.
    if (step.channel === 'email' && row.email) {
      const emailId = prefixedId('eml');
      const idempotencyKey = `recovery:${row.ab_id}:${step.order}`;
      await env.DB.prepare(
        `INSERT OR IGNORE INTO emails (id, store_id, to_email, customer_id, subject, status, idempotency_key, queued_at)
         VALUES (?1,?2,?3,?4,?5,'queued',?6,?7)`,
      )
        .bind(
          emailId,
          row.store_id,
          row.email,
          row.customer_id,
          recoverySubject(step.strategy),
          idempotencyKey,
          now(),
        )
        .run();

      await env.JOBS_QUEUE.send({ kind: 'send_email', emailId, storeId: row.store_id });
    }

    // Mark the step sent regardless of channel availability so we advance the
    // plan (a missing email channel simply skips that send).
    const updatedSent = [...sent, step.order];
    await env.DB.prepare(
      `UPDATE abandoned_carts SET recovery_sent_steps = ?2, recovery_last_sent_at = ?3, strategy = ?4 WHERE id = ?1`,
    )
      .bind(row.ab_id, JSON.stringify(updatedSent), now(), step.strategy)
      .run();

    dispatched++;
  }

  return { dispatched, promoted };
}

function recoverySubject(strategy: string): string {
  switch (strategy) {
    case 'urgency':
      return 'Still want it? Your cart is about to expire';
    case 'social_proof':
      return 'Customers love what’s in your cart';
    case 'free_shipping':
      return 'Free shipping on your cart — complete your order';
    case 'discount':
      return 'A little something to complete your order';
    default:
      return 'You left something in your cart';
  }
}

import { Hono } from 'hono';
import type { LicenseStatus } from '@arre/shared';
import type { Env, Variables } from '../env.js';
import { ok, errors } from '../lib/response.js';
import { hmacSha256Hex } from '../lib/crypto.js';
import { timingSafeEqual } from '@arre/shared';
import { prefixedId, now } from '../lib/ids.js';
import { setLicenseStatus } from '../lib/license.js';

/**
 * Billing webhooks (Stripe-compatible shape). Signature is verified with
 * WEBHOOK_SIGNING_SECRET. Maps billing lifecycle → license status, which the
 * plugin then observes via /plugin/license/validate.
 */
export const webhookRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

const STATUS_MAP: Record<string, LicenseStatus> = {
  'customer.subscription.created': 'active',
  'customer.subscription.updated': 'active',
  'customer.subscription.trial_will_end': 'trialing',
  'customer.subscription.deleted': 'canceled',
  'invoice.payment_failed': 'past_due',
  'invoice.payment_succeeded': 'active',
};

webhookRoutes.post('/billing', async (c) => {
  const secret = c.env.WEBHOOK_SIGNING_SECRET;
  const signature = c.req.header('x-webhook-signature');
  const raw = await c.req.text();

  let signatureOk = false;
  if (secret && signature) {
    const expected = await hmacSha256Hex(secret, raw);
    signatureOk = timingSafeEqual(expected, signature.toLowerCase());
  }

  const id = prefixedId('whk');
  let payload: { type?: string; data?: { object?: { metadata?: { license_id?: string }; current_period_end?: number } } } = {};
  try {
    payload = JSON.parse(raw);
  } catch {
    /* keep empty */
  }

  await c.env.DB.prepare(
    `INSERT INTO billing_webhooks (id, provider, event_type, signature_ok, payload, processed, created_at)
     VALUES (?1,'stripe',?2,?3,?4,0,?5)`,
  )
    .bind(id, payload.type ?? null, signatureOk ? 1 : 0, raw.slice(0, 8000), now())
    .run();

  if (!signatureOk) return errors.unauthorized(c, 'Invalid webhook signature.');

  const status = payload.type ? STATUS_MAP[payload.type] : undefined;
  const licenseId = payload.data?.object?.metadata?.license_id;
  if (status && licenseId) {
    const periodEnd = payload.data?.object?.current_period_end
      ? payload.data.object.current_period_end * 1000
      : undefined;
    await setLicenseStatus(c.env, licenseId, status, periodEnd);
    await c.env.JOBS_QUEUE.send({ kind: 'handle_webhook', webhookId: id });
  }

  await c.env.DB.prepare(`UPDATE billing_webhooks SET processed=1 WHERE id=?1`).bind(id).run();
  return ok(c, { received: true });
});

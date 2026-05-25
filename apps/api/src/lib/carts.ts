import type { EventType } from '@arre/shared';
import type { Env } from '../env.js';
import { prefixedId, now } from './ids.js';

/**
 * Cart lifecycle derived from the event stream. Cart-affecting events keep an
 * `open` cart row fresh; purchase events close it; the scheduled scan promotes
 * idle open carts to `abandoned` so recovery can begin.
 */

const CART_TOUCH_EVENTS: EventType[] = ['add_to_cart', 'cart_updated', 'checkout_started', 'quantity_changed'];
const PURCHASE_EVENTS: EventType[] = ['purchase_completed', 'order_created'];

interface CartEventLike {
  type: EventType;
  visitorId?: string;
  cartToken?: string;
  props?: Record<string, unknown>;
}

function totalFromProps(props?: Record<string, unknown>): number | null {
  if (!props) return null;
  const v = props.cartTotal ?? props.totalCents ?? props.cart_total;
  return typeof v === 'number' ? v : null;
}

/** Apply a batch of events to the cart table (idempotent upserts). */
export async function applyCartEvents(env: Env, storeId: string, events: CartEventLike[]): Promise<void> {
  for (const ev of events) {
    if (CART_TOUCH_EVENTS.includes(ev.type) && ev.cartToken) {
      await env.DB.prepare(
        `INSERT INTO carts (id, store_id, cart_token, visitor_id, total_cents, status, updated_at)
         VALUES (?1,?2,?3,?4,?5,'open',?6)
         ON CONFLICT(store_id, cart_token) DO UPDATE SET
           visitor_id = COALESCE(excluded.visitor_id, carts.visitor_id),
           total_cents = COALESCE(excluded.total_cents, carts.total_cents),
           status = CASE WHEN carts.status = 'purchased' THEN 'purchased' ELSE 'open' END,
           updated_at = excluded.updated_at`,
      )
        .bind(prefixedId('cart'), storeId, ev.cartToken, ev.visitorId ?? null, totalFromProps(ev.props), now())
        .run();
    } else if (PURCHASE_EVENTS.includes(ev.type)) {
      // Close any open/abandoned carts for this visitor (purchase stop condition).
      if (ev.visitorId) {
        await env.DB.prepare(
          `UPDATE carts SET status = 'purchased', updated_at = ?3
             WHERE store_id = ?1 AND visitor_id = ?2 AND status IN ('open','abandoned')`,
        )
          .bind(storeId, ev.visitorId, now())
          .run();
        await env.DB.prepare(
          `UPDATE abandoned_carts SET recovered_at = ?2
             WHERE store_id = ?1 AND recovered_at IS NULL
               AND cart_id IN (SELECT id FROM carts WHERE store_id = ?1 AND visitor_id = ?3)`,
        )
          .bind(storeId, now(), ev.visitorId)
          .run();
      }
      if (ev.cartToken) {
        await env.DB.prepare(
          `UPDATE carts SET status = 'purchased', updated_at = ?3 WHERE store_id = ?1 AND cart_token = ?2`,
        )
          .bind(storeId, ev.cartToken, now())
          .run();
      }
    }
  }
}

/**
 * Promote open carts idle longer than the threshold into abandoned_carts.
 * Idempotent: only inserts an abandoned_carts row if one doesn't already exist
 * for that cart.
 */
export async function promoteAbandonedCarts(
  env: Env,
  thresholdMinutes = 60,
  limit = 200,
): Promise<number> {
  const cutoff = now() - thresholdMinutes * 60000;
  const rows = await env.DB.prepare(
    `SELECT c.id AS cart_id, c.store_id, c.total_cents, c.updated_at
       FROM carts c
      WHERE c.status = 'open' AND c.updated_at < ?1
        AND NOT EXISTS (SELECT 1 FROM abandoned_carts a WHERE a.cart_id = c.id)
      LIMIT ?2`,
  )
    .bind(cutoff, limit)
    .all<{ cart_id: string; store_id: string; total_cents: number | null; updated_at: number }>();

  let promoted = 0;
  for (const r of rows.results ?? []) {
    await env.DB.batch([
      env.DB.prepare(`UPDATE carts SET status = 'abandoned', updated_at = ?2 WHERE id = ?1`).bind(r.cart_id, now()),
      env.DB.prepare(
        `INSERT INTO abandoned_carts (id, store_id, cart_id, stage, abandoned_at, value_cents)
         VALUES (?1,?2,?3,'cart',?4,?5)`,
      ).bind(prefixedId('ab'), r.store_id, r.cart_id, now(), r.total_cents ?? 0),
    ]);
    promoted++;
  }
  return promoted;
}

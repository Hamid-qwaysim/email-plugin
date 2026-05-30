# Architecture

## Components

```
WooCommerce store (WordPress)
  └─ Plugin: ai-revenue-recovery-engine
       ├─ Front-end tracker (assets/js/tracker.js)  ─┐ batched events
       ├─ REST proxy (/arre/v1/track)               ─┤ (same-origin, nonce)
       ├─ License + kill switch (cached decision)    │
       ├─ WooCommerce hooks (cart/checkout/order)     │ signed (HMAC) calls
       ├─ Coupon engine (real WC coupons)             │
       └─ Action Scheduler jobs (sync, validate, kill)│
                                                       ▼
Cloudflare Worker API (apps/api, Hono)  ──────────────┘
  ├─ /v1/plugin/*   signed plugin endpoints (validate, killswitch, events, …)
  ├─ /v1/auth/*     register / login / me (JWT)
  ├─ /v1/merchant/* dashboard data (org-scoped)
  ├─ /v1/admin/*    license issuance, kill switch, entitlements (staff only)
  ├─ /v1/ai/*       AI campaign/email/subject generation
  ├─ /v1/webhooks/* billing webhooks → license status
  ├─ queue consumer scoring, email send, reports, …
  ├─ D1   relational data        KV   license/decision/nonce cache
  ├─ R2   reports/assets/logs     Queues  async jobs
  └─ shared logic from @arre/shared (license state machine, signing spec)

SaaS web app (apps/web, React/Vite → Cloudflare Pages)
  ├─ Landing + pricing (driven by @arre/shared)
  ├─ Merchant dashboard (overview, coupons, license, connect)
  └─ Super-admin console (overview, license management + kill switch)
```

## License lifecycle & kill switch

The single most important rule: **premium features run only while the license
is active.** The decision is computed by `evaluateLicense()` in
`packages/shared/src/license.ts`, shared verbatim by server and tests.

Status → behavior:

| Status            | Premium runs?                    |
|-------------------|----------------------------------|
| `active`          | Yes (until period end + grace)   |
| `trialing`        | Yes (until `trialEndsAt`)        |
| `past_due`        | Yes only inside the grace window |
| `canceled`        | No                               |
| `unpaid`          | No                               |
| `admin_suspended` | No (immediate)                   |
| `expired_trial`   | No                               |
| `revoked`         | No                               |
| kill switch on    | No — overrides everything        |

Propagation:

1. Plugin caches the positive decision for `cacheTtlSeconds` (server-provided,
   capped at 6h client-side as defense-in-depth).
2. Inactive decisions get a short TTL (≤5 min) so reactivation is picked up fast.
3. The plugin polls `/v1/plugin/killswitch` every ~2 minutes; a `kill: true`
   response wipes the cached decision immediately.
4. Admin actions (`/v1/admin/licenses/:id/kill`, `/status`, `/entitlements`) and
   billing webhooks delete the KV-cached decision so the next plugin check
   reflects reality within seconds.

## Request signing (plugin → SaaS)

Defined once in `packages/shared/src/signing.ts` and implemented by the Worker
(`apps/api/src/middleware/signed.ts`, Web Crypto) and the plugin
(`includes/class-arre-api-client.php`, `hash_hmac`). Canonical string:

```
v1
<METHOD>
<PATH no query>
<store_id>
<license_key>
<timestamp seconds>
<nonce>
<sha256 hex of raw body>
```

Verification: headers present → version supported → timestamp within ±300s →
nonce unseen (KV, TTL = skew window) → HMAC matches per-store secret → store↔
license binding correct. Then the route decides whether the license is active.

## Async jobs

`apps/api/src/queue.ts` consumes `arre-jobs` with retries + DLQ. Visitor scoring
and email sending are implemented; coupon decisions, report generation, AI jobs
and webhook fan-out are wired to enqueue and processed incrementally. Writes are
idempotent so retries are safe.

## Provider abstractions

- **AI** (`src/ai/provider.ts`): OpenAI-compatible in production, deterministic
  mock with no key. Guardrails prepended (no fake scarcity/reviews/claims).
- **Email** (`src/email/provider.ts`): SendGrid-compatible, mock fallback,
  suppression checks, subject spam-risk scoring.

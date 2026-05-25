# AI Revenue Recovery Engine

An AI revenue-recovery and growth platform for WooCommerce: a Cloudflare-native
SaaS backend + dashboards, and a WordPress/WooCommerce plugin that connects via
a license key. While the subscription is active, AI marketing, tracking, coupon
generation, email automation, recovery flows and dashboards run. The moment the
license expires, is canceled, or is killed from the admin console, **every
premium feature stops immediately**.

> **Status.** A real, building, tested implementation. All **25 features** are
> implemented with working logic (not stubs): pure decision/engine modules with
> unit tests, backend API endpoints, dashboard pages, and WordPress plugin
> wiring. See **`docs/FEATURES.md`** for the per-feature map and an honest note
> on where the richest UI affordances are intentionally lean and built to be
> extended. The critical commercial path (license lifecycle + kill switch,
> signed plugin↔SaaS comms, secure plugin, recovery, coupons) is the most
> complete. SMS is intentionally excluded.

## Monorepo layout

```
packages/shared      Shared TypeScript contracts (features, plans, license
                     state machine + kill-switch logic, event taxonomy, the
                     HMAC request-signing spec, roles, store-type presets).
apps/api             Cloudflare Worker (Hono). Auth, license validation, the
                     signed plugin API, admin + merchant APIs, AI/email
                     provider abstractions, the queue consumer. D1 migrations.
apps/web             React + Vite SaaS app: landing page, auth, merchant
                     dashboard, super-admin console. Deploys to Cloudflare Pages.
plugin/ai-revenue-recovery-engine
                     The WordPress/WooCommerce plugin (PHP 8.1+, HPOS-ready):
                     connection wizard, license + kill switch, async tracker,
                     coupon engine, WooCommerce sync, diagnostics, secure admin.
scripts              Provisioning, deployment, plugin-zip and verify scripts.
docs                 Architecture, Cloudflare deploy, database, API, plugin,
                     and QA documentation.
```

## Quick start (local)

```bash
npm install
npm run build:shared

# API (Cloudflare Worker) — uses local D1/KV via Miniflare
cp apps/api/.dev.vars.example apps/api/.dev.vars   # then edit secrets
npm run db:migrate:local
npm run dev:api            # http://localhost:8787

# Web (in a second terminal)
echo 'VITE_API_BASE=http://localhost:8787/v1' > apps/web/.env.local
npm run dev:web            # http://localhost:5173
```

Build everything and run tests:

```bash
npm run build      # shared + api typecheck + web bundle
npm run test       # license / signing / coupon / intent unit tests
```

Build the installable plugin zip:

```bash
npm run plugin:zip # -> dist/ai-revenue-recovery-engine.zip
```

## The kill switch (core business rule)

1. The plugin calls `GET /v1/plugin/license/validate` (HMAC-signed) and caches
   the **decision** for a server-provided TTL.
2. It also polls a cheap `GET /v1/plugin/killswitch` every ~2 minutes.
3. The server computes the decision with the shared `evaluateLicense()` state
   machine. An admin flipping the kill switch (`POST /v1/admin/licenses/:id/kill`)
   invalidates the cached decision instantly.
4. When inactive, the plugin disables tracking, sending, coupons, popups,
   recommendations and sync, and shows: *“Your license is inactive. Premium
   features are paused.”*

See `docs/ARCHITECTURE.md` for the full flow and `packages/shared/src/license.ts`
for the authoritative logic (covered by `apps/api/test/license.test.ts`).

## Deploying to Cloudflare

You provide Cloudflare credentials in an untracked file; nothing is hardcoded.

```bash
# 1. Provision D1 / KV / R2 / Queues (one time), then paste IDs into wrangler.toml
./scripts/cf-provision.sh path/to/cloudflare.env

# 2. Set Worker secrets (one time)
cd apps/api && npx wrangler secret put JWT_SECRET && npx wrangler secret put LICENSE_SIGNING_PEPPER && cd ../..

# 3. Deploy API + web + migrations
./scripts/deploy.sh path/to/cloudflare.env

# 4. Smoke test
./scripts/verify-deploy.sh https://arre-api.<your-subdomain>.workers.dev
```

Full details: `docs/CLOUDFLARE.md`.

## Security highlights

- All plugin→SaaS calls are HMAC-SHA256 signed with a per-store secret, with
  timestamp freshness + KV nonce replay protection.
- Passwords hashed with PBKDF2; sessions are signed JWTs; CORS locked to
  configured origins; rate limiting on auth and plugin routes.
- The WordPress plugin follows the Plugin Handbook: nonces, capability checks,
  input sanitization, output escaping, no direct file access, REST permission
  callbacks, and the signing secret is never echoed.
- Secrets live in Worker secret bindings / `.dev.vars` — never committed.

See `docs/` for the database schema, API reference, plugin guide, and the
end-to-end QA checklist.

# Database (Cloudflare D1 / SQLite)

Migrations live in `apps/api/migrations` and are applied with:

```bash
npm run db:migrate:local    # local Miniflare D1
npm run db:migrate:remote   # remote D1 (during deploy)
```

Conventions: string ULID ids, unix-millisecond timestamps, integer cents for
money, JSON text columns for validated payloads.

## Tables

**Identity / orgs**
- `organizations` — merchant or agency; `parent_org_id` links agency → client.
- `users`, `org_members` — users mapped to orgs with a role (multi-org ready).

**Billing / licensing**
- `subscriptions` — provider subscription state.
- `licenses` — key, status, plan, entitlement overrides, period/trial ends,
  grace seconds, cache TTL, `kill_switch`, bound domain, `is_test`, max stores.
- `license_activations` — domain bindings + activation history.
- `license_validation_logs` — every validate call (decision + reason).
- `feature_entitlements` — per-license per-feature override audit.
- `plans` — reference table mirroring `@arre/shared/plans.ts`.

**Stores**
- `stores` — domain, type, per-store `signing_secret`, toggles, brand, plugin/
  WP/Woo versions, HPOS flag, health, last sync/seen.

**Visitors / events**
- `visitors` (intent score + explainable reason, identity merge), `sessions`,
  `events` (indexed by store+time, visitor, type).

**Commerce**
- `customers`, `products`, `orders`, `carts`, `abandoned_carts`.

**Coupons** — `coupons` (type, restrictions, usage, source, AI rationale).

**Automation** — `automations`, `automation_nodes`, `automation_runs`.

**Messaging** — `email_templates`, `emails` (idempotency key), `email_events`,
`messages` (web push / WhatsApp; no SMS).

**Audience** — `segments`, `segment_memberships`.

**On-site** — `popups`, `recommendations`.

**Insights / growth** — `store_doctor_insights`, `reports` (R2 key),
`campaigns`.

**AI / jobs / ops** — `ai_jobs`, `jobs` (idempotent), `audit_logs`,
`admin_actions`, `plugin_diagnostics`, `billing_webhooks`, `api_keys`,
`suppression_list`, `consent_records`.

## Adding a migration

Create `apps/api/migrations/000N_description.sql`. Keep migrations additive on
production D1; to change a column, write a new migration rather than editing an
applied one.

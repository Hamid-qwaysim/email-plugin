# API Reference

Base URL: `https://<worker>/v1`. All responses use an envelope:

```json
{ "ok": true, "data": { ... }, "requestId": "…" }
{ "ok": false, "error": { "code": "…", "message": "…" }, "requestId": "…" }
```

## Auth (`/auth`) — JWT bearer

| Method | Path             | Body                                  | Notes |
|--------|------------------|---------------------------------------|-------|
| POST   | `/auth/register` | `{ email, password, name?, orgName? }`| Creates merchant org + owner. Returns `{ token, user }`. |
| POST   | `/auth/login`    | `{ email, password }`                 | Returns `{ token, user }`. |
| GET    | `/auth/me`       | —                                     | Requires `Authorization: Bearer`. |

## Merchant (`/merchant`) — bearer, org-scoped

| Method | Path                              | Notes |
|--------|-----------------------------------|-------|
| GET    | `/merchant/stores`                | Stores in caller's org. |
| POST   | `/merchant/stores`                | Register store; returns `storeId`, `licenseKey`, **one-time** `signingSecret`. |
| GET    | `/merchant/stores/:id/overview`   | Hero metrics. |
| GET    | `/merchant/stores/:id/coupons`    | Coupons. |
| GET    | `/merchant/stores/:id/segments`   | Segments. |
| PATCH  | `/merchant/stores/:id/toggles`    | Local feature toggles. |
| GET    | `/merchant/license`               | Org license + entitlements. |

## Admin (`/admin`) — bearer, staff only

| Method | Path                                | Notes |
|--------|-------------------------------------|-------|
| GET    | `/admin/overview`                   | Platform KPIs. |
| GET    | `/admin/licenses`                   | All licenses. |
| POST   | `/admin/licenses`                   | Issue license (free/test/beta or paid). |
| POST   | `/admin/licenses/:id/kill`          | `{ killed }` — emergency kill switch. |
| POST   | `/admin/licenses/:id/status`        | `{ status, periodEndsAt? }`. |
| POST   | `/admin/licenses/:id/entitlements`  | `{ overrides: {featureId: bool} }`. |
| GET    | `/admin/stores`                     | Connected stores + health. |
| GET    | `/admin/audit`                      | Recent admin actions. |

## AI (`/ai`) — bearer

| Method | Path           | Body                                 |
|--------|----------------|--------------------------------------|
| POST   | `/ai/campaign` | `{ storeId?, goal }`                 |
| POST   | `/ai/email`    | `{ storeId?, purpose, brandTone? }`  |
| POST   | `/ai/subject`  | `{ context, count? }`                |

## Plugin (`/plugin`) — HMAC-signed (see signing spec)

Required headers: `X-ARRE-Store`, `X-ARRE-License`, `X-ARRE-Timestamp`,
`X-ARRE-Nonce`, `X-ARRE-Signature`, `X-ARRE-Sig-Version`.

| Method | Path                          | Notes |
|--------|-------------------------------|-------|
| GET    | `/plugin/license/validate`    | Authoritative decision + cache TTL + entitlements. |
| GET    | `/plugin/killswitch`          | Cheap `{ kill, reason, recheckInSeconds }`. |
| POST   | `/plugin/license/activate`    | `{ domain }` — bind domain, enforce activation limit. |
| POST   | `/plugin/license/deactivate`  | `{ domain }`. |
| GET    | `/plugin/entitlements`        | Active entitlement list. |
| POST   | `/plugin/events`              | Batched events (rejected when inactive). |
| GET    | `/plugin/onsite`              | Popups/top-bars to render. |
| POST   | `/plugin/diagnostics`         | Store health snapshot. |
| GET    | `/plugin/update-meta`         | Plugin update channel metadata. |

## Webhooks (`/webhooks`)

| Method | Path                 | Notes |
|--------|----------------------|-------|
| POST   | `/webhooks/billing`  | Stripe-shaped; HMAC-verified; maps events → license status. |

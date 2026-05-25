# Cloudflare Deployment Guide

## What gets deployed

- **Worker** `arre-api` — the backend API + queue consumer (`apps/api`).
- **Pages** project `arre-web` — the React SaaS app (`apps/web/dist`).
- **D1** `arre_db`, **KV** `LICENSE_KV` + `NONCE_KV`, **R2** `arre-assets`,
  **Queues** `arre-jobs` (+ `arre-jobs-dlq`).

## Credentials (never committed)

Create an untracked file, e.g. `cloudflare.env` (matched by `.gitignore`):

```bash
export CLOUDFLARE_API_TOKEN="<token with Workers+Pages+D1+KV+R2+Queues edit>"
export CLOUDFLARE_ACCOUNT_ID="<account id>"
```

The deploy scripts `source` this file and pass nothing secret on the command
line or to logs. You can also export these variables by other means (CI secret
store) and omit the file argument.

> Provide your Cloudflare credentials file path to the deploy script — it is
> read at deploy time only and is gitignored. Secrets are never hardcoded,
> printed, committed, or shipped to the frontend.

## Steps

### 1. Provision resources (once)

```bash
./scripts/cf-provision.sh cloudflare.env
```

Copy the printed IDs into `apps/api/wrangler.toml`, replacing:
`REPLACE_WITH_D1_DATABASE_ID`, `REPLACE_WITH_KV_NAMESPACE_ID` (LICENSE_KV),
`REPLACE_WITH_NONCE_KV_NAMESPACE_ID` (NONCE_KV).

### 2. Worker secrets (once)

```bash
cd apps/api
npx wrangler secret put JWT_SECRET
npx wrangler secret put LICENSE_SIGNING_PEPPER
npx wrangler secret put WEBHOOK_SIGNING_SECRET   # optional until billing is wired
# Optional providers:
npx wrangler secret put AI_API_KEY
npx wrangler secret put EMAIL_API_KEY
cd ../..
```

### 3. Deploy

```bash
./scripts/deploy.sh cloudflare.env
```

This builds shared + Worker + web, applies D1 migrations remotely, deploys the
Worker and the Pages site, and prints the URLs.

### 4. Verify

```bash
./scripts/verify-deploy.sh https://arre-api.<your-subdomain>.workers.dev
```

Checks `/health`, the response envelope, that unsigned plugin calls are rejected
(401), and that bad logins fail cleanly (not 500).

### 5. Point the web app at the API

Set `VITE_API_BASE` to the Worker URL + `/v1` for the Pages build (Pages env var
or `apps/web/.env.production`), then redeploy the web app.

## Rollback

- **Worker:** `npx wrangler rollback` (or `npx wrangler deployments list` then
  `rollback <id>`).
- **Pages:** in the Cloudflare dashboard, promote a previous deployment, or
  redeploy a known-good commit.
- **D1 migrations** are additive; to revert a schema change author a new
  migration rather than dropping tables on a production database.

## Notes

- The Worker uses `nodejs_compat`; the `compatibility_date` is pinned in
  `wrangler.toml`.
- Queue consumer settings (batch size, retries, DLQ) live in `wrangler.toml`.
- CORS is restricted to `ALLOWED_ORIGINS`; update it to your real dashboard
  domain(s).

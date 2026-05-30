#!/usr/bin/env bash
#
# Deploy the AI Revenue Recovery Engine to Cloudflare (Workers API + Pages web).
#
# Credentials: this script NEVER hardcodes or prints secrets. Provide them via
# environment variables, optionally sourced from an untracked file you pass as
# the first argument:
#
#   ./scripts/deploy.sh path/to/cloudflare.env
#
# That file (gitignored) should export:
#   export CLOUDFLARE_API_TOKEN=...      # token with Workers+Pages+D1+KV+R2+Queues edit
#   export CLOUDFLARE_ACCOUNT_ID=...
#
# Prereqs: run ./scripts/cf-provision.sh once to create D1/KV/R2/Queues and to
# fill the binding IDs in apps/api/wrangler.toml.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# --- Load credentials from the provided file (kept out of git). ---
if [[ "${1:-}" != "" && -f "$1" ]]; then
  # shellcheck disable=SC1090
  set +x
  source "$1"
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" || -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "ERROR: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set (env or credentials file)." >&2
  exit 1
fi

echo "==> Building shared package"
npm run build:shared

echo "==> Type-checking + building Worker"
npm run build:api

echo "==> Building web (Cloudflare Pages bundle)"
npm run build:web

echo "==> Applying D1 migrations (remote)"
( cd apps/api && npx wrangler d1 migrations apply arre_db --remote )

echo "==> Deploying Worker API"
( cd apps/api && npx wrangler deploy )

echo "==> Deploying web to Cloudflare Pages"
( cd apps/web && npx wrangler pages deploy dist --project-name arre-web --commit-dirty=true )

echo ""
echo "==> Deployment complete."
echo "    Worker API:  https://arre-api.<your-subdomain>.workers.dev  (see output above)"
echo "    Web (Pages): https://arre-web.pages.dev                     (see output above)"
echo ""
echo "Post-deploy checklist:"
echo "  - Set Worker secrets (once): JWT_SECRET, LICENSE_SIGNING_PEPPER, WEBHOOK_SIGNING_SECRET"
echo "      cd apps/api && npx wrangler secret put JWT_SECRET"
echo "  - Verify health:  curl https://<worker-url>/health"
echo "  - Run scripts/verify-deploy.sh <worker-url> for smoke tests."

#!/usr/bin/env bash
#
# One-time provisioning of Cloudflare resources. Creates the D1 database, KV
# namespaces, R2 bucket, and Queues, then prints the binding IDs you must paste
# into apps/api/wrangler.toml (replacing the REPLACE_WITH_* placeholders).
#
# Usage:  ./scripts/cf-provision.sh path/to/cloudflare.env
#
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/apps/api"

if [[ "${1:-}" != "" && -f "$1" ]]; then
  set +x; source "$1"
fi
: "${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN}"
: "${CLOUDFLARE_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID}"

echo "==> Creating D1 database 'arre_db'"
npx wrangler d1 create arre_db || true

echo "==> Creating KV namespaces"
npx wrangler kv namespace create LICENSE_KV || true
npx wrangler kv namespace create NONCE_KV || true

echo "==> Creating R2 bucket 'arre-assets'"
npx wrangler r2 bucket create arre-assets || true

echo "==> Creating Queues"
npx wrangler queues create arre-jobs || true
npx wrangler queues create arre-jobs-dlq || true

cat <<'NOTE'

==> Done provisioning.

Copy the IDs printed above into apps/api/wrangler.toml, replacing:
  - REPLACE_WITH_D1_DATABASE_ID
  - REPLACE_WITH_KV_NAMESPACE_ID         (LICENSE_KV)
  - REPLACE_WITH_NONCE_KV_NAMESPACE_ID   (NONCE_KV)

Then set the Worker secrets:
  npx wrangler secret put JWT_SECRET
  npx wrangler secret put LICENSE_SIGNING_PEPPER
  npx wrangler secret put WEBHOOK_SIGNING_SECRET

Finally run: ./scripts/deploy.sh path/to/cloudflare.env
NOTE

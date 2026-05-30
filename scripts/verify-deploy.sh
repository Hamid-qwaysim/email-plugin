#!/usr/bin/env bash
#
# Post-deploy smoke tests. Usage: ./scripts/verify-deploy.sh https://arre-api.<sub>.workers.dev
#
set -euo pipefail
BASE="${1:?Usage: verify-deploy.sh <worker-base-url>}"
BASE="${BASE%/}"

pass() { echo "  PASS: $1"; }
fail() { echo "  FAIL: $1" >&2; exit 1; }

echo "==> Verifying $BASE"

code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/health")
[[ "$code" == "200" ]] && pass "GET /health -> 200" || fail "GET /health -> $code"

body=$(curl -s "$BASE/")
echo "$body" | grep -q '"ok":true' && pass "root returns ok envelope" || fail "root envelope unexpected: $body"

# Unsigned plugin call must be rejected (401).
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/v1/plugin/license/validate")
[[ "$code" == "401" ]] && pass "unsigned plugin call -> 401" || fail "unsigned plugin call -> $code (expected 401)"

# Auth route should reject bad login (400/401), not 500.
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/v1/auth/login" -H 'content-type: application/json' -d '{"email":"x@y.z","password":"nope"}')
[[ "$code" == "401" || "$code" == "400" ]] && pass "bad login rejected ($code)" || fail "bad login -> $code"

echo "==> All smoke tests passed."

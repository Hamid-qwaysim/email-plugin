#!/usr/bin/env bash
#
# Build an installable WordPress plugin zip from plugin/ai-revenue-recovery-engine.
# Output: dist/ai-revenue-recovery-engine.zip
#
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/plugin/ai-revenue-recovery-engine"
OUT_DIR="$ROOT/dist"
OUT="$OUT_DIR/ai-revenue-recovery-engine.zip"

[[ -d "$SRC" ]] || { echo "Plugin source not found at $SRC" >&2; exit 1; }
mkdir -p "$OUT_DIR"
rm -f "$OUT"

# Lint every PHP file before packaging.
while IFS= read -r -d '' f; do
  php -l "$f" >/dev/null
done < <(find "$SRC" -name '*.php' -print0)

( cd "$ROOT/plugin" && zip -rq "$OUT" "ai-revenue-recovery-engine" \
    -x '*/node_modules/*' '*/.git/*' '*/tests/*' )

echo "Built: $OUT"

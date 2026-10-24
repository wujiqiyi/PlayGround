#!/usr/bin/env bash
# Build the game and serve the static output in the foreground.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PORT="${PORT:-3000}"
WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
DIST_DIR="$SCRIPT_DIR/dist"

/usr/bin/time -p mkdir -p "$WEB_DIR"

if [[ ! -x "$SCRIPT_DIR/node_modules/.bin/vite" ]]; then
  if [[ -f "$SCRIPT_DIR/package-lock.json" ]]; then
    /usr/bin/time -p npm ci --no-audit --no-fund
  else
    /usr/bin/time -p npm install --no-audit --no-fund
  fi
fi

/usr/bin/time -p npm run build

/usr/bin/time -p printf '{"project":"%s","directory":"%s"}\n' "$SCRIPT_DIR" "$DIST_DIR" \
  > "$WEB_DIR/deployment-output.json"

/usr/bin/time -p cat "$WEB_DIR/deployment-output.json"

exec /usr/bin/time -p "$SCRIPT_DIR/node_modules/.bin/vite" preview \
  --host 0.0.0.0 \
  --port "$PORT" \
  --strictPort

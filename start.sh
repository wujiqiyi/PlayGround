#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

PORT="${PORT:-3000}"
WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
DIST_DIR="$PROJECT_DIR/dist"

run() {
  echo "[start] $*"
  /usr/bin/time -p "$@"
}

mkdir -p "$WEB_DIR"

if [[ -f package.json ]]; then
  if [[ ! -d node_modules ]] || [[ package.json -nt node_modules/.package-lock.json ]] || { [[ -f package-lock.json ]] && [[ package-lock.json -nt node_modules/.package-lock.json ]]; }; then
    if [[ -f package-lock.json ]]; then
      run npm ci --no-audit --no-fund
    else
      run npm install --no-audit --no-fund
    fi
  fi
  run npm run build
fi

if [[ ! -f "$DIST_DIR/index.html" ]]; then
  echo "[start] Missing static build at $DIST_DIR/index.html" >&2
  exit 1
fi

run node -e '
const fs = require("node:fs");
const [file, project, directory] = process.argv.slice(1);
fs.mkdirSync(require("node:path").dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify({ project, directory }));
' "$WEB_DIR/deployment-output.json" "$PROJECT_DIR" "$DIST_DIR"

echo "[start] Serving $DIST_DIR on port $PORT"
exec /usr/bin/time -p node "$PROJECT_DIR/scripts/serve.mjs" "$DIST_DIR" "$PORT"

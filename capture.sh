#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
: "${CAPTURE_URL:?CAPTURE_URL is required}"
: "${CAPTURE_DIR:?CAPTURE_DIR is required}"

export CAPTURE_URL CAPTURE_DIR
export RUNTIME_DIR="${RUNTIME_DIR:-/home/runner/work/_temp/omgithub-runtime}"

mkdir -p "$CAPTURE_DIR"
echo "[capture] Target URL: $CAPTURE_URL"
echo "[capture] Output dir: $CAPTURE_DIR"

status=0
/usr/bin/time -p node "$PROJECT_DIR/scripts/capture.mjs" || status=$?

echo "[capture] Exit status: $status"
exit "$status"

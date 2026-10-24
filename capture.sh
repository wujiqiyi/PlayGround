#!/usr/bin/env bash
# Capture desktop and mobile screenshots of the running game preview.
set -euo pipefail

: "${CAPTURE_URL:?Set CAPTURE_URL to the preview URL.}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR to an output directory outside the source tree.}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

/usr/bin/time -p mkdir -p "$CAPTURE_DIR"

export CAPTURE_URL
export CAPTURE_DIR

/usr/bin/time -p node "$SCRIPT_DIR/scripts/capture.mjs"

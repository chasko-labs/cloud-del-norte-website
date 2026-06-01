#!/bin/bash
# One-shot: render logo-vector.svg to 1024x1024 PNG, then clean up this script.
# Usage: bash scripts/render-logo-vector.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
rsvg-convert -w 1024 -h 1024 --keep-aspect-ratio \
  -o lib/brand/logo-vector-1024.png lib/brand/logo-vector.svg
echo "✓ lib/brand/logo-vector-1024.png rendered"

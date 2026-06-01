#!/usr/bin/env bash
# CDN Logo Clean – iteration pipeline
# Runs the fill remap, renders PNG, uploads to S3 for verification.
# Usage: bash scripts/iterate-logo-clean.sh
set -euo pipefail
cd "$(dirname "$0")/.."

BRANCH="feat/logo-clean-fill-remap-v4"
PNG="cdn-logo-clean-v4-1024.png"
SVG="lib/brand/logo-clean.svg"

echo "=== Step 1: Create feature branch ==="
git fetch origin main
git checkout -B "$BRANCH" origin/main

echo "=== Step 2: Run fill remap ==="
node scripts/remap-logo-fills.mjs

echo "=== Step 3: Verify path count ==="
PATHS=$(grep -c '<path ' "$SVG")
echo "Path count: $PATHS (expect 353)"
if [ "$PATHS" -ne 353 ]; then
  echo "ERROR: Path count mismatch!" >&2
  exit 1
fi

echo "=== Step 4: Render 1024px transparent PNG ==="
rsvg-convert -w 1024 -h 1024 --format png "$SVG" > "$PNG"
echo "Rendered: $PNG ($(stat -c%s "$PNG") bytes)"

echo "=== Step 5: Upload to S3 ==="
aws s3 cp "$PNG" "s3://dev.clouddelnorte.org/_previews/$PNG" \
  --profile aerospaceug-admin --content-type image/png
echo "Published: https://dev.clouddelnorte.org/_previews/$PNG"

echo "=== Step 6: Commit ==="
git add "$SVG" "$PNG"
git commit -m "feat(brand): logo-clean.svg fill remap v4 – 3-color banding fix

Preserves all 353 canonical VTracer trace paths exactly.
Strips animated glow defs/style, remaps 336 banding fills to:
  - #FCFCFD (white) – outline, arms, sparkles, center
  - #9B5CF4 (violet) – tip diamonds, bulbs, arm accent fills
  - #5A1F8A (deep purple) – inner lattice
"

echo "=== Step 7: Push ==="
git push -u origin "$BRANCH"

echo ""
echo "Done. Preview: https://dev.clouddelnorte.org/_previews/$PNG"
echo "Branch: $BRANCH"

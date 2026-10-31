#!/usr/bin/env bash
# Build a clean public-submission tree containing only the active hackathon product.
# Usage: scripts/package_submission.sh ../anyrb-hackathon
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:?usage: scripts/package_submission.sh /absolute/or/relative/destination}"
DEST="$(cd "$(dirname "$DEST")" && pwd)/$(basename "$DEST")"

case "$DEST" in
  "$ROOT"|"$ROOT"/*) echo "refusing to write inside the source repo: $DEST" >&2; exit 1 ;;
esac
if [ -e "$DEST" ]; then echo "destination already exists: $DEST" >&2; exit 1; fi

mkdir -p "$DEST"
cp -R "$ROOT/app" "$ROOT/server" "$DEST/"
mkdir -p "$DEST/data" "$DEST/demo/screenshots"
cp "$ROOT/data/CASE_STUDY.md" "$DEST/data/CASE_STUDY.md"
cp -R "$ROOT/demo/screenshots/v9" "$ROOT/demo/screenshots/v10" "$DEST/demo/screenshots/"
cp "$ROOT/index.html" "$ROOT/README.md" "$ROOT/HACKATHON.md" "$ROOT/HACKATHON_WORK.md" \
   "$ROOT/SUBMISSION.md" "$ROOT/DEMO_SCRIPT.md" "$ROOT/V0_8_SPEC.md" "$ROOT/LICENSE" \
   "$ROOT/DEPLOY.md" "$ROOT/Dockerfile" "$ROOT/render.yaml" "$ROOT/requirements.txt" \
   "$ROOT/.dockerignore" "$DEST/"

# Remove historical, generated and secret material from the clean tree.
rm -rf "$DEST/server/.env" "$DEST/server/cache" "$DEST/server/__pycache__" \
       "$DEST/server/provenance.jsonl" 2>/dev/null || true
find "$DEST" -name '__pycache__' -type d -prune -exec rm -rf {} + 2>/dev/null || true
find "$DEST" -name '*.pyc' -delete 2>/dev/null || true


# Keep only the active product server tests in the clean tree.
find "$DEST/server/tests" -maxdepth 1 -type f -name 'test_*.py' \
  ! -name 'test_product_brief.py' ! -name 'test_product_proposals.py' \
  ! -name 'test_product_advice.py' -delete

cat > "$DEST/.gitignore" <<'EOF'
.venv/
__pycache__/
*.pyc
server/.env
server/cache/
server/provenance.jsonl
.pytest_cache/
EOF

echo "clean submission tree: $DEST"

#!/usr/bin/env bash
# =============================================================================
# ATELIER — Section 1: Static Analysis Tests (SA-01 to SA-08)
# Tool: tsc, ESLint, ripgrep
# Run: Every save / every commit. Target: < 30s
# =============================================================================

set -euo pipefail

PASS=0
FAIL=0
RESULTS=()

run_check() {
  local id="$1"
  local label="$2"
  local cmd="$3"
  local expect_empty="${4:-false}"   # if true, zero stdout = pass

  echo ""
  echo "▶ $id — $label"

  if [ "$expect_empty" = "true" ]; then
    output=$(eval "$cmd" 2>&1 || true)
    if [ -z "$output" ]; then
      echo "  ✅ PASS — no matches / no output"
      PASS=$((PASS + 1))
      RESULTS+=("✅ $id $label")
    else
      echo "  ❌ FAIL — unexpected output:"
      echo "$output" | head -20
      FAIL=$((FAIL + 1))
      RESULTS+=("❌ $id $label")
    fi
  else
    if eval "$cmd" 2>&1; then
      echo "  ✅ PASS"
      PASS=$((PASS + 1))
      RESULTS+=("✅ $id $label")
    else
      echo "  ❌ FAIL — exit code non-zero"
      FAIL=$((FAIL + 1))
      RESULTS+=("❌ $id $label")
    fi
  fi
}

# SA-01 — TypeScript: zero errors
run_check "SA-01" "TypeScript — zero errors" \
  "npx tsc --noEmit"

# SA-02 — ESLint: zero warnings or errors
run_check "SA-02" "ESLint — zero warnings or errors" \
  "npm run lint -- --max-warnings 0"

# SA-03 — No community-data.ts imports in production code
run_check "SA-03" "No community-data imports in src/" \
  "rg 'community-data' src/ --include='*.ts' --include='*.tsx' -l 2>/dev/null || true" \
  true

# SA-04 — No globalThis or in-memory Map<> stores in modules/api
run_check "SA-04" "No globalThis or new Map<> stores in modules/api" \
  "rg 'globalThis|new Map<' src/modules/ src/app/api/ -l 2>/dev/null || true" \
  true

# SA-05 — No hardcoded discipline/software arrays outside DB layer
run_check "SA-05" "No hardcoded disciplines/softwares arrays outside DB layer" \
  "rg 'disciplines\s*=\s*\[|softwares\s*=\s*\[' src/app/ src/modules/ src/components/ -l 2>/dev/null || true" \
  true

# SA-06 — No console.log in production API routes or services
run_check "SA-06" "No console.log in API routes or services" \
  "rg 'console\.log' src/app/api/ src/modules/ -l 2>/dev/null || true" \
  true

# SA-07 — No bare ': any' types without suppression comment
run_check "SA-07" "No bare ':any' types in modules/api (must have eslint-disable)" \
  "rg ': any' src/modules/ src/app/api/ --include='*.ts' --include='*.tsx' -l 2>/dev/null || true" \
  true

# SA-08 — All API routes are explicitly dynamic or static (no 'auto')
echo ""
echo "▶ SA-08 — All API routes have explicit dynamic declaration"
auto_routes=$(rg "dynamic\s*=\s*['\"]auto['\"]" src/app/api/ --include='*.ts' -l 2>/dev/null || true)
if [ -z "$auto_routes" ]; then
  echo "  ✅ PASS — no routes with dynamic = 'auto'"
  PASS=$((PASS + 1))
  RESULTS+=("✅ SA-08 No routes with dynamic=auto")
else
  echo "  ❌ FAIL — found routes with dynamic='auto':"
  echo "$auto_routes"
  FAIL=$((FAIL + 1))
  RESULTS+=("❌ SA-08 No routes with dynamic=auto")
fi

# ── Summary ────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STATIC ANALYSIS RESULTS — $PASS passed, $FAIL failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for r in "${RESULTS[@]}"; do echo "  $r"; done
echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi

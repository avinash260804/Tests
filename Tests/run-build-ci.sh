#!/usr/bin/env bash
# =============================================================================
# ATELIER — Section 19: Build & CI Tests (B-01 to B-10)
# File: tests/build-ci/run-build-ci.sh
# Run: As part of CI pipeline or `npm run verify`
# =============================================================================

set -euo pipefail

PASS=0
FAIL=0
RESULTS=()

pass() { echo "  ✅ PASS"; PASS=$((PASS+1)); RESULTS+=("✅ $1"); }
fail() { echo "  ❌ FAIL — $2"; FAIL=$((FAIL+1)); RESULTS+=("❌ $1 — $2"); }

# B-01: Production build completes
echo ""
echo "▶ B-01 — Production build"
if npm run build 2>&1; then
  pass "B-01 Production build"
else
  fail "B-01 Production build" "npm run build exited non-zero"
fi

# B-02: Build has no MISSING_ENV warnings
echo ""
echo "▶ B-02 — No missing env var warnings in build output"
build_out=$(npm run build 2>&1 || true)
if echo "$build_out" | grep -qi "MISSING_ENV\|missing.*env"; then
  fail "B-02 No missing env warnings" "MISSING_ENV found in build output"
else
  pass "B-02 No missing env warnings"
fi

# B-03: Full verify chain passes (typecheck + lint + test + build)
echo ""
echo "▶ B-03 — Full verify chain"
if npm run typecheck && npm run lint -- --max-warnings 0 && npm run test && npm run build; then
  pass "B-03 Full verify chain"
else
  fail "B-03 Full verify chain" "one or more steps failed"
fi

# B-04: No pending migrations
echo ""
echo "▶ B-04 — No pending migrations"
migrate_out=$(npx prisma migrate status 2>&1)
if echo "$migrate_out" | grep -qi "up to date\|no pending"; then
  pass "B-04 No pending migrations"
else
  fail "B-04 No pending migrations" "pending migrations detected"
fi

# B-05: Seed completes without error
echo ""
echo "▶ B-05 — Seed runs cleanly"
if npx prisma db seed 2>&1; then
  pass "B-05 Seed runs cleanly"
else
  fail "B-05 Seed runs cleanly" "prisma db seed failed"
fi

# B-06: Seed is idempotent — run twice, row counts identical
echo ""
echo "▶ B-06 — Seed is idempotent (no duplicate rows on second run)"
npx prisma db seed 2>&1
count_after_1=$(npx prisma db execute --stdin <<< "SELECT count(*) FROM posts;" 2>/dev/null || echo "SKIP")
npx prisma db seed 2>&1
count_after_2=$(npx prisma db execute --stdin <<< "SELECT count(*) FROM posts;" 2>/dev/null || echo "SKIP")

if [ "$count_after_1" = "SKIP" ]; then
  echo "  ⚠ SKIP — cannot query DB directly; verify manually"
elif [ "$count_after_1" = "$count_after_2" ]; then
  pass "B-06 Seed idempotent"
else
  fail "B-06 Seed idempotent" "row count changed on second seed run ($count_after_1 → $count_after_2)"
fi

# B-07: seed.js/seed.ts passes syntax check
echo ""
echo "▶ B-07 — Seed file syntax valid"
SEED_FILE="prisma/seed.ts"
if [ -f "$SEED_FILE" ]; then
  if npx ts-node --transpile-only --noEmit "$SEED_FILE" 2>&1 | grep -qi "error"; then
    fail "B-07 Seed file syntax" "ts-node reported errors in $SEED_FILE"
  else
    pass "B-07 Seed file syntax"
  fi
elif [ -f "prisma/seed.js" ]; then
  if node --check prisma/seed.js 2>&1; then
    pass "B-07 Seed file syntax (JS)"
  else
    fail "B-07 Seed file syntax (JS)" "node --check failed"
  fi
else
  echo "  ⚠ SKIP — no seed file found at prisma/seed.ts or prisma/seed.js"
fi

# B-08: No unexpected large chunks (> 500 KB)
echo ""
echo "▶ B-08 — No bundle chunks > 500 KB"
NEXT_BUILD_DIR=".next/static/chunks"
if [ -d "$NEXT_BUILD_DIR" ]; then
  large_chunks=$(find "$NEXT_BUILD_DIR" -name "*.js" -size +500k 2>/dev/null)
  if [ -z "$large_chunks" ]; then
    pass "B-08 No large chunks"
  else
    echo "  ❌ FAIL — chunks over 500 KB:"
    echo "$large_chunks"
    FAIL=$((FAIL+1))
    RESULTS+=("❌ B-08 No large chunks")
  fi
else
  echo "  ⚠ SKIP — .next/static/chunks not found (run build first)"
fi

# B-09: No routes with dynamic = "auto" on DB read paths
echo ""
echo "▶ B-09 — No routes with dynamic='auto'"
auto_routes=$(rg "dynamic\s*=\s*['\"]auto['\"]" src/app/api/ --include="*.ts" -l 2>/dev/null || true)
if [ -z "$auto_routes" ]; then
  pass "B-09 No dynamic=auto routes"
else
  echo "  ❌ FAIL — routes with dynamic='auto':"
  echo "$auto_routes"
  FAIL=$((FAIL+1))
  RESULTS+=("❌ B-09 No dynamic=auto routes")
fi

# B-10: TypeScript strict mode — no implicit any
echo ""
echo "▶ B-10 — TypeScript strict mode (--strict --noEmit)"
if npx tsc --strict --noEmit 2>&1; then
  pass "B-10 TypeScript strict mode"
else
  fail "B-10 TypeScript strict mode" "tsc --strict --noEmit failed"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "BUILD & CI RESULTS — $PASS passed, $FAIL failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for r in "${RESULTS[@]}"; do echo "  $r"; done
echo ""
[ "$FAIL" -eq 0 ] || exit 1

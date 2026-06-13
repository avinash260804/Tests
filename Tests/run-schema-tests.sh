#!/usr/bin/env bash
# =============================================================================
# ATELIER — Section 2: Schema & Migration Tests (SCH-01 to SCH-10)
# Tool: prisma validate, prisma migrate status, pgTAP
# Run: After any schema change. Target: < 10s
# =============================================================================

set -euo pipefail

PASS=0
FAIL=0
RESULTS=()

pass() { echo "  ✅ PASS"; PASS=$((PASS+1)); RESULTS+=("✅ $1"); }
fail() { echo "  ❌ FAIL — $2"; FAIL=$((FAIL+1)); RESULTS+=("❌ $1"); }

echo ""
echo "▶ SCH-01 — Prisma schema is valid"
if npx prisma validate 2>&1 | grep -q "schema is valid"; then
  pass "SCH-01 Prisma schema valid"
else
  fail "SCH-01 Prisma schema valid" "prisma validate failed"
fi

echo ""
echo "▶ SCH-02 — Prisma client in sync with schema"
gen_output=$(npx prisma generate 2>&1)
if echo "$gen_output" | grep -q "Schema has changed"; then
  fail "SCH-02 Prisma client in sync" "Schema has changed warning present"
else
  pass "SCH-02 Prisma client in sync"
fi

echo ""
echo "▶ SCH-03 — No pending unapplied migrations"
if npx prisma migrate status 2>&1 | grep -q "up to date"; then
  pass "SCH-03 No pending migrations"
else
  fail "SCH-03 No pending migrations" "pending migrations found"
fi

echo ""
echo "▶ SCH-04 — Post model has deletedAt field"
if grep -q "deletedAt.*DateTime?" prisma/schema.prisma; then
  pass "SCH-04 Post.deletedAt present"
else
  fail "SCH-04 Post.deletedAt present" "deletedAt not found in Post model"
fi

echo ""
echo "▶ SCH-05 — Comment model has deletedAt field"
comment_count=$(awk '/^model Comment/,/^}/' prisma/schema.prisma | grep -c "deletedAt" || true)
if [ "$comment_count" -ge 1 ]; then
  pass "SCH-05 Comment.deletedAt present"
else
  fail "SCH-05 Comment.deletedAt present" "deletedAt not found in Comment model"
fi

echo ""
echo "▶ SCH-06 — Post and Comment have indexes on deletedAt"
migration_dir="prisma/migrations"
if ls "$migration_dir" 2>/dev/null | head -1 | grep -q .; then
  idx_count=$(grep -r "CREATE INDEX.*deleted_at" "$migration_dir" 2>/dev/null | wc -l)
  if [ "$idx_count" -ge 2 ]; then
    pass "SCH-06 deletedAt indexes in migrations"
  else
    fail "SCH-06 deletedAt indexes in migrations" "found $idx_count (need >= 2)"
  fi
else
  echo "  ⚠ SKIP — no migrations directory found"
fi

echo ""
echo "▶ SCH-07 — Vote table has unique constraint (authorId, postId)"
if grep -q '@@unique(\[authorId, postId\])' prisma/schema.prisma; then
  pass "SCH-07 Vote.@@unique(authorId, postId)"
else
  fail "SCH-07 Vote.@@unique(authorId, postId)" "constraint not found"
fi

echo ""
echo "▶ SCH-08 — Vote table has unique constraint (authorId, commentId)"
if grep -q '@@unique(\[authorId, commentId\])' prisma/schema.prisma; then
  pass "SCH-08 Vote.@@unique(authorId, commentId)"
else
  fail "SCH-08 Vote.@@unique(authorId, commentId)" "constraint not found"
fi

echo ""
echo "▶ SCH-09 + SCH-10 — Running pgTAP tests via Supabase CLI"
if command -v supabase &> /dev/null; then
  if npx supabase test db --local 2>&1; then
    pass "SCH-09 pgTAP posts table assertions"
    pass "SCH-10 pgTAP votes constraints assertions"
  else
    fail "SCH-09 pgTAP posts table assertions" "pgTAP tests failed"
    fail "SCH-10 pgTAP votes constraints assertions" "pgTAP tests failed"
  fi
else
  echo "  ⚠ SKIP — supabase CLI not available (run: npx supabase start first)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SCHEMA RESULTS — $PASS passed, $FAIL failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for r in "${RESULTS[@]}"; do echo "  $r"; done
echo ""
[ "$FAIL" -eq 0 ] || exit 1

# CODEX — Atelier Test Suite Execution Prompt

## Context

You are working on **Atelier**, a Next.js App Router application with the following stack:

- **Framework:** Next.js 14+ (App Router)
- **ORM:** Prisma
- **Database:** Supabase (PostgreSQL + Row Level Security)
- **Language:** TypeScript (strict mode)
- **Unit/Integration test runner:** Vitest
- **E2E / Security / A11Y / Visual / Performance tests:** Playwright
- **RLS tests:** pgTAP via Supabase CLI
- **Component tests:** React Testing Library + @testing-library/user-event
- **API mocking:** MSW (Mock Service Worker)
- **DB mocking:** prismock

The full test suite covers **310 tests across 19 categories**. All test files are in the
`atelier-tests/` directory, organized by category. Your job is to copy them into the correct
project locations, resolve every error, and make all 310 tests pass with zero failures.

---

## Step 1 — Environment Setup

Before running any test, verify and install all required dependencies.

```bash
# Vitest stack
npm install -D vitest @vitejs/plugin-react jsdom vite-tsconfig-paths
npm install -D @testing-library/react @testing-library/user-event @testing-library/jest-dom
npm install -D prismock msw uuid
npm install -D @vitest/coverage-v8

# Playwright + accessibility + visual
npm install -D @playwright/test @axe-core/playwright
npx playwright install --with-deps chromium

# Supabase CLI (for RLS pgTAP tests)
npm install -D supabase
```

Confirm these config files exist in the project root. If missing, copy from `atelier-tests/config/`:

| File | Destination |
|---|---|
| `atelier-tests/config/vitest.config.ts` | `./vitest.config.ts` |
| `atelier-tests/config/playwright.config.ts` | `./playwright.config.ts` |
| `atelier-tests/config/setup.ts` | `./tests/setup.ts` |
| `atelier-tests/config/auth.setup.ts` | `./tests/e2e/auth.setup.ts` |

---

## Step 2 — Environment Variables

Create a `.env.test` file in the project root with the following variables.
**Do not commit real credentials.** Use the values from your Supabase local stack and test seed:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:54322/postgres"
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:54322/postgres"

# Supabase local
NEXT_PUBLIC_SUPABASE_URL="http://localhost:54321"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<your-local-anon-key>"
SUPABASE_SERVICE_ROLE_KEY="<your-local-service-role-key>"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
BASE_URL="http://localhost:3000"

# Test users (created by seed — must exist in DB before E2E tests run)
TEST_USER_A_EMAIL="user-a@atelier-test.com"
TEST_USER_A_PASSWORD="Password123!"
TEST_USER_A_USERNAME="user-a"
TEST_USER_A_TOKEN="<supabase-session-token-for-user-a>"
TEST_USER_A_POST_ID="<id-of-a-post-owned-by-user-a>"
TEST_USER_A_COMMENT_ID="<id-of-a-comment-owned-by-user-a>"

TEST_USER_B_EMAIL="user-b@atelier-test.com"
TEST_USER_B_PASSWORD="Password123!"
TEST_USER_B_USERNAME="user-b"
TEST_USER_B_TOKEN="<supabase-session-token-for-user-b>"
TEST_USER_B_POST_ID="<id-of-a-post-owned-by-user-b>"

# Seeded content slugs (used by E2E, error boundary, and performance tests)
TEST_SEEDED_POST_SLUG="seeded-discussion-post"
TEST_SEEDED_POST_TITLE="Seeded Discussion Post"
TEST_EMPTY_COMMENT_POST_SLUG="seeded-post-no-comments"
TEST_DELETED_POST_SLUG="seeded-deleted-post"
TEST_EMPTY_DISCIPLINE_SLUG="empty-discipline-test"

# Rate limiting
RATE_LIMIT_WINDOW_MS="60000"
TEST_RATE_LIMIT_TOKEN="<token-for-rate-limit-test-user>"
```

---

## Step 3 — Copy Test Files into Project

Copy each file from `atelier-tests/` to the corresponding project path below.
**Do not rename any file. Do not merge into existing files unless instructed.**

### Config files
```
atelier-tests/config/vitest.config.ts         → ./vitest.config.ts
atelier-tests/config/playwright.config.ts     → ./playwright.config.ts
atelier-tests/config/setup.ts                 → ./tests/setup.ts
atelier-tests/config/auth.setup.ts            → ./tests/e2e/auth.setup.ts
```

### Shared test infrastructure
```
atelier-tests/factories/prismock-instance.ts  → ./tests/factories/prismock-instance.ts
atelier-tests/factories/model-factories.ts    → ./tests/factories/model-factories.ts
atelier-tests/msw/server.ts                   → ./tests/msw/server.ts
atelier-tests/msw/handlers.ts                 → ./tests/msw/handlers.ts
```

### Unit tests
```
atelier-tests/unit/helpers/helpers.test.ts                       → ./src/lib/__tests__/helpers.test.ts
atelier-tests/unit/post-service/post-service.test.ts             → ./src/modules/posts/__tests__/post-service.test.ts
atelier-tests/unit/comment-service/comment-service.test.ts       → ./src/modules/comments/__tests__/comment-service.test.ts
atelier-tests/unit/help-service/help-solution-service.test.ts    → ./src/modules/help/__tests__/help-solution-service.test.ts
atelier-tests/unit/vote-service/vote-service.test.ts             → ./src/modules/votes/__tests__/vote-service.test.ts
atelier-tests/unit/misc-services/misc-services.test.ts           → ./src/modules/__tests__/misc-services.test.ts
```

### Integration tests
```
atelier-tests/integration/integration.test.ts → ./tests/integration/integration.test.ts
```

### API route tests
```
atelier-tests/api-routes/api-routes.test.ts   → ./src/app/api/__tests__/api-routes.test.ts
```

### Component, snapshot, and form tests
```
atelier-tests/components/components.test.tsx        → ./src/__tests__/components/components.test.tsx
atelier-tests/snapshots/snapshots.test.tsx          → ./tests/snapshots/snapshots.test.tsx
atelier-tests/form-validation/form-validation.test.tsx → ./tests/forms/form-validation.test.tsx
```

### RLS / pgTAP SQL files
```
atelier-tests/rls/01_posts_rls.sql        → ./tests/rls/01_posts_rls.sql
atelier-tests/rls/02_comments_rls.sql     → ./tests/rls/02_comments_rls.sql
atelier-tests/rls/03_votes_rls.sql        → ./tests/rls/03_votes_rls.sql
atelier-tests/rls/04_profiles_rls.sql     → ./tests/rls/04_profiles_rls.sql
atelier-tests/rls/05_cross_table_rls.sql  → ./tests/rls/05_cross_table_rls.sql
atelier-tests/schema/schema.test.sql      → ./tests/rls/00_schema.test.sql
```

### E2E / Security / Accessibility / Performance tests
```
atelier-tests/e2e/flows/user-flows.spec.ts            → ./tests/e2e/flows/user-flows.spec.ts
atelier-tests/e2e/errors/error-boundaries.spec.ts     → ./tests/e2e/errors/error-boundaries.spec.ts
atelier-tests/security/security.spec.ts               → ./tests/e2e/security/security.spec.ts
atelier-tests/accessibility/a11y-visual-perf.spec.ts  → ./tests/e2e/accessibility/a11y-visual-perf.spec.ts
```

### Static analysis and CI scripts
```
atelier-tests/static-analysis/run-static-analysis.sh → ./tests/scripts/run-static-analysis.sh
atelier-tests/schema/run-schema-tests.sh             → ./tests/scripts/run-schema-tests.sh
atelier-tests/build-ci/run-build-ci.sh               → ./tests/scripts/run-build-ci.sh
```

Make all `.sh` files executable:
```bash
chmod +x tests/scripts/*.sh
```

---

## Step 4 — Add package.json Scripts

Merge the following into the `"scripts"` section of `package.json`.
**Do not remove existing scripts:**

```json
{
  "scripts": {
    "test":               "vitest run",
    "test:watch":         "vitest",
    "test:unit":          "vitest run src/lib src/modules",
    "test:integration":   "vitest run tests/integration",
    "test:api":           "vitest run src/app/api",
    "test:components":    "vitest run src/__tests__/components",
    "test:forms":         "vitest run tests/forms",
    "test:snapshots":     "vitest run tests/snapshots",
    "test:coverage":      "vitest run --coverage",
    "test:e2e":           "playwright test tests/e2e/flows",
    "test:e2e:security":  "playwright test tests/e2e/security",
    "test:e2e:errors":    "playwright test tests/e2e/errors",
    "test:a11y":          "playwright test tests/e2e/accessibility",
    "test:perf":          "playwright test tests/e2e/accessibility --grep PERF",
    "test:visual":        "playwright test tests/e2e/accessibility --grep VR",
    "test:rls":           "supabase test db",
    "test:static":        "bash tests/scripts/run-static-analysis.sh",
    "test:schema":        "bash tests/scripts/run-schema-tests.sh",
    "test:build-ci":      "bash tests/scripts/run-build-ci.sh",
    "test:all":           "npm run test && npm run test:e2e && npm run test:rls",
    "typecheck":          "tsc --noEmit",
    "verify":             "npm run typecheck && npm run lint && npm run test && npm run build"
  }
}
```

---

## Step 5 — Fix Import Paths

Every test file imports from `@/lib/...`, `@/modules/...`, `@/components/...`, and
`@/app/api/...`. These aliases must resolve correctly via `tsconfig.json` and `vitest.config.ts`.

Verify `tsconfig.json` has:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

For each import that fails to resolve, update the path to match the actual file location in
the project. **Do not change the test logic — only fix the import path.**

Common patterns to verify:
```
@/lib/slug              → src/lib/slug.ts
@/lib/pagination        → src/lib/pagination.ts
@/lib/sanitize          → src/lib/sanitize.ts
@/lib/rate-limit        → src/lib/rate-limit.ts
@/lib/handle-error      → src/lib/handle-error.ts
@/lib/require-auth      → src/lib/require-auth.ts
@/modules/posts/post-service         → src/modules/posts/post-service.ts
@/modules/comments/comment-service   → src/modules/comments/comment-service.ts
@/modules/help/help-solution-service → src/modules/help/help-solution-service.ts
@/modules/votes/vote-service         → src/modules/votes/vote-service.ts
@/modules/reputation/reputation-service → src/modules/reputation/reputation-service.ts
@/modules/feed/feed-service          → src/modules/feed/feed-service.ts
@/modules/search/search-service      → src/modules/search/search-service.ts
@/modules/tags/tag-service           → src/modules/tags/tag-service.ts
@/modules/profiles/profile-service   → src/modules/profiles/profile-service.ts
@/components/HeroPage                → src/components/HeroPage.tsx
@/components/Dashboard               → src/components/Dashboard.tsx
@/components/ThreadPage              → src/components/ThreadPage.tsx
@/components/VoteControl             → src/components/VoteControl.tsx
@/components/ProfilePage             → src/components/ProfilePage.tsx
@/components/PostCreationForm        → src/components/PostCreationForm.tsx
@/components/ProfileEditForm         → src/components/ProfileEditForm.tsx
@/components/LoginForm               → src/components/LoginForm.tsx
@/components/SearchResults           → src/components/SearchResults.tsx
```

---

## Step 6 — Run Tests by Category (in order)

Run each category independently. Fix all failures before moving to the next category.
**Do not skip a failing category.**

### 6a — Static Analysis (target: 0 errors, < 30s)
```bash
npm run typecheck
npm run lint -- --max-warnings 0
npm run test:static
```

### 6b — Schema & Migration (target: all pass, < 10s)
```bash
npm run test:schema
npx supabase start
npx supabase test db tests/rls/00_schema.test.sql
```

### 6c — Unit Tests (target: 82 tests pass, < 30s)
```bash
npm run test:unit
```

Expected: helpers (18), post-service (14), comment-service (10),
help-solution-service (8), vote-service (10), misc-services (22) = **82 tests**

### 6d — Integration Tests (target: 20 tests pass, < 60s)
```bash
# Start local Supabase first
npx supabase start
npm run test:integration
```

### 6e — API Route Tests (target: 30 tests pass, < 30s)
```bash
npm run test:api
```

### 6f — Component Tests (target: 30 tests pass, < 30s)
```bash
npm run test:components
```

### 6g — Snapshot Tests (target: 8 tests pass, < 10s)
```bash
npm run test:snapshots
```
On first run, snapshots are created (no baseline yet — this is expected).
On subsequent runs, they must match.

### 6h — Form Validation Tests (target: 12 tests pass, < 20s)
```bash
npm run test:forms
```

### 6i — RLS / pgTAP Tests (target: 20 SQL assertions pass, < 60s)
```bash
npx supabase start
npm run test:rls
```

### 6j — E2E Auth Setup (must run ONCE before any E2E test)
```bash
npx playwright test tests/e2e/auth.setup.ts
# Creates: tests/e2e/.auth/user-a.json and tests/e2e/.auth/user-b.json
```

### 6k — Security Tests (target: 18 tests pass, < 5 min)
```bash
npm run test:e2e:security
```

### 6l — E2E User Flows (target: 30 tests pass, < 10 min)
```bash
npm run test:e2e
```

### 6m — E2E Error Boundaries (target: 12 tests pass, < 3 min)
```bash
npm run test:e2e:errors
```

### 6n — Accessibility Tests (target: 8 tests pass, < 5 min)
```bash
npm run test:a11y
```

### 6o — Visual Regression Tests (target: 6 tests pass, < 5 min)
```bash
npm run test:visual
```
On first run: baselines are created. On subsequent runs: pixel diffs must be < 2%.

### 6p — Performance Tests (target: 6 tests pass, < 5 min)
```bash
npm run test:perf
```

### 6q — Build & CI Tests (target: 10 checks pass, < 3 min)
```bash
npm run test:build-ci
```

---

## Step 7 — Debugging Rules

When a test fails, follow this decision tree strictly:

1. **Import/module not found** → Fix the `@/` path alias. Do NOT rewrite the test.
2. **Function signature mismatch** (e.g. test calls `createPost(prisma, userId, input)` but
   service only accepts `createPost(input)`) → **Update the service function signature**
   to accept the parameters the test expects. The tests define the contract.
3. **Missing `data-testid` attribute on a component** → Add the attribute to the component.
   Do not change the test selector.
4. **AppError not thrown / wrong status code** → Fix the service or route handler to throw
   the correct `AppError` with the correct HTTP status. Tests define expected behavior.
5. **Prismock model not found** → Add the missing model relation to `prisma/schema.prisma`
   and re-run `npx prisma generate`.
6. **Snapshot mismatch** → If the change is intentional, run `vitest run --update-snapshots`
   to accept. If unintentional, fix the component regression.
7. **pgTAP assertion fails** → The RLS policy in `supabase/migrations/` or `supabase/rls.sql`
   is wrong. Fix the SQL policy, not the test.
8. **E2E `storageState` file missing** → Run step 6j first to generate auth files.
9. **ENV variable undefined** → Add the variable to `.env.test`. Never hardcode secrets.
10. **MSW handler not matched** → Add or update the handler in `tests/msw/handlers.ts`.

---

## Step 8 — Full Suite Run

Once all categories pass individually, run the complete suite:

```bash
# Unit + integration + component + API + snapshot + form
npm run test

# All E2E categories
npm run test:e2e
npm run test:e2e:security
npm run test:e2e:errors
npm run test:a11y
npm run test:visual
npm run test:perf

# RLS
npm run test:rls

# Static + build
npm run test:static
npm run test:build-ci

# Full verify chain (CI gate)
npm run verify
```

**Pass condition:** All 310 tests green. `npm run verify` exits 0. Zero TypeScript errors.
Zero ESLint warnings. Production build completes clean.

---

## Step 9 — Create KNOWN_GAPS.md

After the full suite passes, create this file at the project root:

```markdown
# KNOWN_GAPS.md

Last updated: [DATE]
Test suite version: Atelier Master Test Suite — 310 tests / 19 categories

## Gaps / Skipped Tests

| ID | Reason | Owner | Target Fix Date |
|---|---|---|---|
| (none) | All 310 tests passing | — | — |

## Notes

- Visual regression baselines generated on: [DATE] / [VIEWPORT]
- Rate-limit window for SEC-18: 60s (set via RATE_LIMIT_WINDOW_MS)
- E2E auth storageState files are gitignored — re-run auth.setup.ts after session expiry
```

---

## Constraints

- **Never delete or rewrite a test** to make it pass. The tests define correct behavior.
  Fix the production code, the service, the component, or the route handler instead.
- **Never use `test.skip` or `it.skip`** unless a test is explicitly marked optional in
  the master suite document.
- **Never hardcode secrets** in any test file. All secrets go in `.env.test`.
- **All 310 tests must be green** before the suite is considered complete.
- When in doubt about expected behavior, the test ID descriptions in
  `ATELIER_MASTER_TEST_SUITE.md` are the source of truth.

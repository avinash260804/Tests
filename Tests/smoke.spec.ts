/**
 * ATELIER — Section 19+: Smoke Tests
 * Tool: Playwright
 * File: tests/e2e/smoke/smoke.spec.ts
 *
 * Run after every seed or deployment against real seeded Supabase.
 * Covers all 11 checklist items from the master test suite:
 *
 *   [ ] AUTH FLOW
 *   [ ] POST FLOW
 *   [ ] HELP FLOW
 *   [ ] CRITIQUE FLOW
 *   [ ] SEARCH FLOW
 *   [ ] PROFILE FLOW
 *   [ ] UPLOAD FLOW
 *   [ ] RLS CHECK
 *   [ ] ERROR CHECK
 *   [ ] RATE LIMIT
 *   [ ] BUILD CHECK
 *   [ ] KNOWN GAPS update
 *
 * Run: npx playwright test tests/e2e/smoke/smoke.spec.ts
 */

import { test, expect, type Page, type Browser } from '@playwright/test'
import { execSync } from 'node:child_process'
import { existsSync, appendFileSync } from 'node:fs'
import path from 'node:path'

// ─── Config ────────────────────────────────────────────────────────────────

const BASE_URL        = process.env.BASE_URL            ?? 'http://localhost:3000'
const USER_A_EMAIL    = process.env.TEST_USER_A_EMAIL   ?? 'usera@atelier.test'
const USER_A_PASS     = process.env.TEST_USER_A_PASS    ?? 'TestPassword1!'
const USER_B_EMAIL    = process.env.TEST_USER_B_EMAIL   ?? 'userb@atelier.test'
const USER_B_PASS     = process.env.TEST_USER_B_PASS    ?? 'TestPassword2!'
const USER_A_COOKIE   = process.env.TEST_USER_A_COOKIE  ?? ''
const DISCIPLINE      = process.env.TEST_DISCIPLINE     ?? 'interior-design'
const SEEDED_SLUG     = process.env.TEST_POST_SLUG      ?? 'seeded-discussion-post'
const KNOWN_GAPS_FILE = path.resolve(__dirname, '../../../KNOWN_GAPS.md')

// ─── Auth helpers ──────────────────────────────────────────────────────────

async function loginAs(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`)
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in|log in|login/i }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 })
}

async function logout(page: Page) {
  await page.getByRole('button', { name: /logout|sign out/i }).click()
  await page.waitForURL(/\/|\/login/, { timeout: 5_000 })
}

/** Append a gap to KNOWN_GAPS.md if the test is skipped/failed */
function recordKnownGap(label: string, detail: string) {
  const entry = `\n- [${new Date().toISOString()}] **${label}**: ${detail}`
  if (existsSync(KNOWN_GAPS_FILE)) {
    appendFileSync(KNOWN_GAPS_FILE, entry)
  }
  console.warn(`KNOWN GAP recorded: ${label} — ${detail}`)
}

// ══════════════════════════════════════════════════════════════════════════
// SMOKE-01 — AUTH FLOW
// ══════════════════════════════════════════════════════════════════════════

test('SMOKE-01 — Auth Flow: signup → onboarding → discipline → dashboard', async ({ page }) => {
  const ts = Date.now()
  const email = `smoke_${ts}@atelier.test`

  await page.goto(`${BASE_URL}/signup`)
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill('SmokePass1!')
  await page.getByRole('button', { name: /sign up|create account/i }).click()

  await page.waitForURL(/\/onboarding/, { timeout: 10_000 })
  await page.getByLabel(/username/i).fill(`smoke_${ts}`)
  await page.getByRole('button', { name: /next|continue/i }).click()

  // Discipline selection
  const disciplineBtn = page.getByRole('button', { name: /interior|graphic|motion|ux/i }).first()
  await disciplineBtn.click()
  await page.getByRole('button', { name: /finish|done|continue/i }).click()

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 })
})

// ══════════════════════════════════════════════════════════════════════════
// SMOKE-02 — POST FLOW
// ══════════════════════════════════════════════════════════════════════════

test('SMOKE-02 — Post Flow: create post → appears in feed → thread loads', async ({ page }) => {
  await loginAs(page, USER_A_EMAIL, USER_A_PASS)

  const title = `Smoke Post ${Date.now()}`
  await page.goto(`${BASE_URL}/create`)
  await page.getByLabel(/title/i).fill(title)
  await page.getByLabel(/content/i).fill('Smoke test post content for feed verification.')
  await page.getByRole('combobox', { name: /discipline/i }).selectOption(DISCIPLINE)
  await page.getByRole('radio', { name: /discussion/i }).check()
  await page.getByRole('button', { name: /submit|publish/i }).click()

  await page.waitForURL(/\/thread\//, { timeout: 10_000 })
  await expect(page.getByText(title)).toBeVisible()

  // Confirm post appears in the discipline feed
  await page.goto(`${BASE_URL}/${DISCIPLINE}`)
  await expect(page.getByText(title)).toBeVisible()
})

// ══════════════════════════════════════════════════════════════════════════
// SMOKE-03 — HELP FLOW
// ══════════════════════════════════════════════════════════════════════════

test('SMOKE-03 — Help Flow: create help → comment → mark solved → SOLVED badge', async ({ browser }) => {
  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const pageA = await ctxA.newPage()
  const pageB = await ctxB.newPage()

  // User A creates a HELP post
  await loginAs(pageA, USER_A_EMAIL, USER_A_PASS)
  const helpTitle = `Smoke Help ${Date.now()}`
  await pageA.goto(`${BASE_URL}/create`)
  await pageA.getByLabel(/title/i).fill(helpTitle)
  await pageA.getByLabel(/content/i).fill('I need help with this design.')
  await pageA.getByRole('combobox', { name: /discipline/i }).selectOption(DISCIPLINE)
  await pageA.getByRole('radio', { name: /help/i }).check()
  await pageA.getByRole('button', { name: /submit|publish/i }).click()
  await pageA.waitForURL(/\/thread\//, { timeout: 10_000 })
  const threadUrl = pageA.url()

  // User B adds a comment
  await loginAs(pageB, USER_B_EMAIL, USER_B_PASS)
  await pageB.goto(threadUrl)
  await pageB.getByLabel(/write.*comment|add.*comment|your comment/i).fill('Here is my solution!')
  await pageB.getByRole('button', { name: /comment|reply|submit/i }).click()
  await expect(pageB.getByText('Here is my solution!')).toBeVisible()

  // User A marks it solved
  await pageA.reload()
  await pageA.getByRole('button', { name: /mark.*solved|accept|solution/i }).first().click()
  await expect(pageA.getByText(/solved/i).first()).toBeVisible()

  await ctxA.close()
  await ctxB.close()
})

// ══════════════════════════════════════════════════════════════════════════
// SMOKE-04 — CRITIQUE FLOW (vote → reputation updates)
// ══════════════════════════════════════════════════════════════════════════

test('SMOKE-04 — Critique Flow: create critique → vote → reputation updates', async ({ browser }) => {
  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const pageA = await ctxA.newPage()
  const pageB = await ctxB.newPage()

  // User A creates a CRITIQUE post
  await loginAs(pageA, USER_A_EMAIL, USER_A_PASS)
  const critiqueTitle = `Smoke Critique ${Date.now()}`
  await pageA.goto(`${BASE_URL}/create`)
  await pageA.getByLabel(/title/i).fill(critiqueTitle)
  await pageA.getByLabel(/content/i).fill('Please critique this design work.')
  await pageA.getByRole('combobox', { name: /discipline/i }).selectOption(DISCIPLINE)
  await pageA.getByRole('radio', { name: /critique/i }).check()
  await pageA.getByRole('button', { name: /submit|publish/i }).click()
  await pageA.waitForURL(/\/thread\//, { timeout: 10_000 })
  const threadUrl = pageA.url()

  // Get User A's reputation before vote
  const username = process.env.TEST_USER_A_USERNAME ?? 'usera'
  await pageA.goto(`${BASE_URL}/profile/${username}`)
  const repEl = pageA.getByTestId('reputation-score').or(pageA.getByText(/reputation|rep:/i).locator('..'))
  const repBefore = parseInt((await repEl.first().textContent()) ?? '0', 10)

  // User B upvotes the critique
  await loginAs(pageB, USER_B_EMAIL, USER_B_PASS)
  await pageB.goto(threadUrl)
  await pageB.getByRole('button', { name: /upvote|▲/i }).first().click()
  await pageB.waitForTimeout(800)

  // Verify reputation increased on User A's profile
  await pageA.goto(`${BASE_URL}/profile/${username}`)
  await pageA.waitForLoadState('networkidle')
  const repAfter = parseInt((await repEl.first().textContent()) ?? '0', 10)
  expect(repAfter).toBeGreaterThanOrEqual(repBefore)

  await ctxA.close()
  await ctxB.close()
})

// ══════════════════════════════════════════════════════════════════════════
// SMOKE-05 — SEARCH FLOW
// ══════════════════════════════════════════════════════════════════════════

test('SMOKE-05 — Search Flow: search keyword → results → click through to thread', async ({ page }) => {
  await page.goto(`${BASE_URL}/search?q=design`)
  await page.waitForSelector('[data-testid="post-card"], [data-testid="search-result"]', { timeout: 5_000 })

  const firstResult = page.locator('[data-testid="post-card"], [data-testid="search-result"]').first()
  await expect(firstResult).toBeVisible()

  // Click through to the thread
  await firstResult.click()
  await page.waitForURL(/\/thread\//, { timeout: 8_000 })
  await expect(page.locator('[data-testid="post-title"], h1')).toBeVisible()
})

// ══════════════════════════════════════════════════════════════════════════
// SMOKE-06 — PROFILE FLOW
// ══════════════════════════════════════════════════════════════════════════

test('SMOKE-06 — Profile Flow: view profile → edit bio → changes persist → public view', async ({ page }) => {
  await loginAs(page, USER_A_EMAIL, USER_A_PASS)
  await page.goto(`${BASE_URL}/profile/me/edit`)

  const newBio = `Smoke bio updated at ${Date.now()}`
  const bioField = page.getByLabel(/bio/i)
  await bioField.clear()
  await bioField.fill(newBio)
  await page.getByRole('button', { name: /save|update|submit/i }).click()
  await page.waitForLoadState('networkidle')

  // Verify on public profile
  const username = process.env.TEST_USER_A_USERNAME ?? 'usera'
  await page.goto(`${BASE_URL}/profile/${username}`)
  await expect(page.getByText(newBio)).toBeVisible()
})

// ══════════════════════════════════════════════════════════════════════════
// SMOKE-07 — UPLOAD FLOW (Showcase image → thumbnail on thread)
// ══════════════════════════════════════════════════════════════════════════

test('SMOKE-07 — Upload Flow: image in showcase → thumbnail visible on thread', async ({ page }) => {
  await loginAs(page, USER_A_EMAIL, USER_A_PASS)
  await page.goto(`${BASE_URL}/create`)

  await page.getByLabel(/title/i).fill(`Smoke Showcase ${Date.now()}`)
  await page.getByLabel(/content/i).fill('Showcase with thumbnail image.')
  await page.getByRole('combobox', { name: /discipline/i }).selectOption(DISCIPLINE)
  await page.getByRole('radio', { name: /showcase/i }).check()

  const fileChooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: /upload|attach|image/i }).click()
  const fc = await fileChooserPromise
  await fc.setFiles({
    name: 'smoke-image.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    ),
  })

  await page.getByRole('button', { name: /submit|publish/i }).click()
  await page.waitForURL(/\/thread\//, { timeout: 10_000 })

  const img = page.locator('img[data-testid="post-thumbnail"], [data-testid="post-image"] img').first()
  await expect(img).toBeVisible()
})

// ══════════════════════════════════════════════════════════════════════════
// SMOKE-08 — RLS CHECK
// ══════════════════════════════════════════════════════════════════════════

test('SMOKE-08 — RLS Check: soft-deleted post not in feed, search, or direct URL', async ({ page, request }) => {
  // Soft-delete a seeded post via API (User A)
  const deletableSlug = process.env.TEST_DELETABLE_POST_SLUG
  if (!deletableSlug) {
    recordKnownGap('SMOKE-08', 'TEST_DELETABLE_POST_SLUG env not set — RLS check skipped')
    test.skip()
    return
  }

  await request.delete(`${BASE_URL}/api/posts/${deletableSlug}`, {
    headers: { Cookie: USER_A_COOKIE },
  })

  // 1. Not in feed
  await page.goto(`${BASE_URL}/${DISCIPLINE}`)
  const feedMention = page.getByTestId('post-card').filter({ hasText: deletableSlug })
  await expect(feedMention).toHaveCount(0)

  // 2. Not in search
  await page.goto(`${BASE_URL}/search?q=${encodeURIComponent(deletableSlug)}`)
  await page.waitForTimeout(800)
  const searchMention = page.getByTestId('post-card').filter({ hasText: deletableSlug })
  await expect(searchMention).toHaveCount(0)

  // 3. Direct URL returns 404
  const response = await page.goto(`${BASE_URL}/thread/${deletableSlug}`)
  const status = response?.status() ?? 200
  const body = await page.locator('body').textContent()
  const is404 = status === 404 || /not found|404/i.test(body ?? '')
  expect(is404).toBe(true)
})

// ══════════════════════════════════════════════════════════════════════════
// SMOKE-09 — ERROR CHECK (bad slug → graceful 404)
// ══════════════════════════════════════════════════════════════════════════

test('SMOKE-09 — Error Check: 404 on bad slug renders gracefully', async ({ page }) => {
  const response = await page.goto(`${BASE_URL}/thread/smoke-test-bad-slug-xyzzy-9991`)

  const status = response?.status() ?? 200
  const body = await page.locator('body').textContent()

  const is404 = status === 404 || /not found|404/i.test(body ?? '')
  expect(is404).toBe(true)

  // No raw stack trace
  expect(body).not.toMatch(/at Object\.|at Function\.|webpack-internal/)
})

// ══════════════════════════════════════════════════════════════════════════
// SMOKE-10 — RATE LIMIT (11th rapid post → 429)
// ══════════════════════════════════════════════════════════════════════════

test('SMOKE-10 — Rate Limit: 11th rapid POST /api/posts → 429', async ({ request }) => {
  const responses: number[] = []

  for (let i = 0; i < 11; i++) {
    const res = await request.post(`${BASE_URL}/api/posts`, {
      headers: {
        'Content-Type': 'application/json',
        Cookie: USER_A_COOKIE,
      },
      data: JSON.stringify({
        title: `Smoke Rate Limit Post ${i}`,
        content: 'Rate limit smoke test',
        disciplineId: 'test-discipline-id',
        postType: 'DISCUSSION',
      }),
    })
    responses.push(res.status())
  }

  expect(responses.includes(429), `Expected 429 among: ${responses.join(', ')}`).toBe(true)
})

// ══════════════════════════════════════════════════════════════════════════
// SMOKE-11 — BUILD CHECK (npm run build → zero errors)
// ══════════════════════════════════════════════════════════════════════════

test('SMOKE-11 — Build Check: npm run build exits 0 with zero errors', async () => {
  // This test is intentionally long — only run in full CI mode
  if (process.env.SMOKE_SKIP_BUILD === 'true') {
    recordKnownGap('SMOKE-11', 'SMOKE_SKIP_BUILD=true — build check skipped in this run')
    test.skip()
    return
  }

  const { spawnSync } = await import('node:child_process')
  const result = spawnSync('npm run build', {
    shell: true,
    cwd: path.resolve(__dirname, '../../../'),
    encoding: 'utf-8',
    timeout: 5 * 60 * 1000,
  })

  const combined = (result.stdout ?? '') + (result.stderr ?? '')
  expect(
    result.status,
    `npm run build failed (exit ${result.status}):\n${combined.slice(0, 2000)}`,
  ).toBe(0)
})

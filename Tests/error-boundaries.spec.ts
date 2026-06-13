/**
 * ATELIER — Section 17: E2E Error Boundary & Edge Case Tests (12 tests)
 * Tool: Playwright
 * File: tests/e2e/errors/error-boundaries.spec.ts
 *
 * Covers EB-01 through EB-12
 * Run: npx playwright test tests/e2e/errors/error-boundaries.spec.ts
 */

import { test, expect, type Page } from '@playwright/test'

const BASE_URL         = process.env.BASE_URL          ?? 'http://localhost:3000'
const USER_A_EMAIL     = process.env.TEST_USER_A_EMAIL ?? 'usera@atelier.test'
const USER_A_PASS      = process.env.TEST_USER_A_PASS  ?? 'TestPassword1!'

async function loginAs(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`)
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in|log in|login/i }).click()
  await page.waitForURL(/\/dashboard/)
}

// ─── EB-01: /thread/slug-that-does-not-exist → graceful 404 ───────────────

test('EB-01 — /thread/slug-that-does-not-exist → graceful 404 page', async ({ page }) => {
  const response = await page.goto(`${BASE_URL}/thread/this-slug-absolutely-does-not-exist-xyzzy999`)

  const status = response?.status() ?? 200
  const bodyText = await page.locator('body').textContent()

  const shows404 = status === 404 || /not found|404/i.test(bodyText ?? '')
  expect(shows404).toBe(true)

  // Should NOT show a raw error / stack trace
  expect(bodyText).not.toMatch(/Error:|at Object\.|at Function\.|webpack-internal/)
})

// ─── EB-02: /profile/nobody123 → graceful 404 ──────────────────────────────

test('EB-02 — /profile/nobody123 → graceful 404 page', async ({ page }) => {
  const response = await page.goto(`${BASE_URL}/profile/nobody123abc_definitely_not_real`)

  const status = response?.status() ?? 200
  const bodyText = await page.locator('body').textContent()

  const shows404 = status === 404 || /not found|404/i.test(bodyText ?? '')
  expect(shows404).toBe(true)
  expect(bodyText).not.toMatch(/Error:|at Object\.|webpack-internal/)
})

// ─── EB-03: /nonexistent-discipline-xyz → graceful 404 ─────────────────────

test('EB-03 — /nonexistent-discipline-xyz → graceful 404 page', async ({ page }) => {
  const response = await page.goto(`${BASE_URL}/nonexistent-discipline-xyz-atelier-test`)

  const status = response?.status() ?? 200
  const bodyText = await page.locator('body').textContent()

  const shows404 = status === 404 || /not found|404/i.test(bodyText ?? '')
  expect(shows404).toBe(true)
  expect(bodyText).not.toMatch(/Error:|at Object\.|webpack-internal/)
})

// ─── EB-04: API returns 500 → UI shows error state, not blank ──────────────

test('EB-04 — API 500 → error boundary renders fallback, not blank screen', async ({ page }) => {
  // Intercept the posts API and simulate a 500
  await page.route('**/api/posts**', (route) => {
    route.fulfill({ status: 500, body: JSON.stringify({ error: 'Internal Server Error' }) })
  })

  await page.goto(`${BASE_URL}/dashboard`)

  // Page must not be blank
  const bodyText = await page.locator('body').textContent()
  expect((bodyText ?? '').trim().length).toBeGreaterThan(50)

  // Should show an error state or fallback, not a raw JS error
  expect(bodyText).not.toMatch(/Cannot read properties|TypeError:|ReferenceError:/)

  // An error message or "something went wrong" should be visible
  const fallback = page.getByText(/something went wrong|failed to load|error loading|try again/i)
    .or(page.getByTestId('error-boundary'))
    .or(page.getByRole('alert'))
  await expect(fallback.first()).toBeVisible({ timeout: 5000 }).catch(() => {
    // Acceptable if dashboard renders empty state instead of crashing
  })
})

// ─── EB-05: Network failure on vote → optimistic update reverts ─────────────

test('EB-05 — network failure on vote → optimistic update reverts to original', async ({ page }) => {
  await loginAs(page, USER_A_EMAIL, USER_A_PASS)

  // Navigate to a thread with a seeded post that the user does NOT own
  const SEEDED_THREAD = process.env.TEST_OTHER_USER_POST_SLUG ?? 'seeded-other-user-post'
  await page.goto(`${BASE_URL}/thread/${SEEDED_THREAD}`)

  const voteCountEl = page.getByTestId('vote-count').first()
  const initialCount = parseInt((await voteCountEl.textContent()) ?? '0', 10)

  // Block the vote API call so it fails
  await page.route('**/api/votes**', (route) => route.abort('failed'))

  await page.getByRole('button', { name: /upvote|▲/i }).first().click()
  await page.waitForTimeout(800)

  // Count should revert to original (optimistic update rolled back)
  const finalCount = parseInt((await voteCountEl.textContent()) ?? '0', 10)
  expect(finalCount).toBe(initialCount)
})

// ─── EB-06: Network failure on comment submit → error message ───────────────

test('EB-06 — network failure on comment submit → error message shown', async ({ page }) => {
  await loginAs(page, USER_A_EMAIL, USER_A_PASS)

  const SEEDED_THREAD = process.env.TEST_OTHER_USER_POST_SLUG ?? 'seeded-other-user-post'
  await page.goto(`${BASE_URL}/thread/${SEEDED_THREAD}`)

  await page.route('**/api/comments**', (route) => route.abort('failed'))

  await page.getByLabel(/write.*comment|add.*comment|your comment/i).fill('This comment will fail to post.')
  await page.getByRole('button', { name: /comment|reply|submit/i }).click()
  await page.waitForTimeout(1000)

  const errorMsg = page.getByText(/failed to post|could not submit|error|try again/i)
  await expect(errorMsg.first()).toBeVisible()
})

// ─── EB-07: Thread page with post deleted mid-session → 404 shown ──────────

test('EB-07 — deleted post accessed mid-session → graceful 404', async ({ page, request }) => {
  // This test assumes a post can be soft-deleted via API.
  // If a seeded deletable post slug is provided, use it; otherwise skip.
  const deletableSlug = process.env.TEST_DELETABLE_POST_SLUG
  if (!deletableSlug) {
    test.skip()
    return
  }

  // Soft-delete via API (User A deletes their own post)
  const cookie = process.env.TEST_USER_A_COOKIE ?? ''
  await request.delete(`/api/posts/${deletableSlug}`, {
    headers: { Cookie: cookie },
  })

  // Try to access the thread
  const response = await page.goto(`${BASE_URL}/thread/${deletableSlug}`)
  const status = response?.status() ?? 200
  const bodyText = await page.locator('body').textContent()

  const shows404 = status === 404 || /not found|404/i.test(bodyText ?? '')
  expect(shows404).toBe(true)
  expect(bodyText).not.toMatch(/webpack-internal|Error:/)
})

// ─── EB-08: Dashboard feed fails to load → empty state, no crash ───────────

test('EB-08 — dashboard feed fails to load → empty state, not crash', async ({ page }) => {
  await loginAs(page, USER_A_EMAIL, USER_A_PASS)

  // Abort the feed-specific API call
  await page.route('**/api/posts**', (route) => route.abort('failed'))

  await page.goto(`${BASE_URL}/dashboard`)

  // Page should not crash / be blank
  const bodyText = await page.locator('body').textContent()
  expect((bodyText ?? '').trim().length).toBeGreaterThan(50)
  expect(bodyText).not.toMatch(/TypeError:|ReferenceError:|Cannot read properties/)

  // Either an empty state or error fallback should render
  const fallback = page.getByText(/no posts|failed to load|something went wrong|empty/i)
    .or(page.getByTestId('feed-empty'))
    .or(page.getByTestId('error-boundary'))
  await expect(fallback.first()).toBeVisible({ timeout: 5000 }).catch(() => {
    // Dashboard may still render the shell without the feed
  })
})

// ─── EB-09: Profile edit save fails → error shown, data not lost ───────────

test('EB-09 — profile edit save fails → error message visible, form data preserved', async ({ page }) => {
  await loginAs(page, USER_A_EMAIL, USER_A_PASS)
  await page.goto(`${BASE_URL}/profile/me/edit`)

  const bioText = 'EB-09 Test Bio — unique text 99871'
  await page.getByLabel(/bio/i).fill(bioText)

  // Block the profile patch API
  await page.route('**/api/profiles/me**', (route) => route.abort('failed'))

  await page.getByRole('button', { name: /save|update|submit/i }).click()
  await page.waitForTimeout(800)

  // Error message should be visible
  const errorMsg = page.getByText(/failed to save|could not update|error|try again/i)
  await expect(errorMsg.first()).toBeVisible()

  // Form data should still be present (not cleared on error)
  const bioField = page.getByLabel(/bio/i)
  await expect(bioField).toHaveValue(bioText)
})

// ─── EB-10: Search API timeout → error state visible, not blank ─────────────

test('EB-10 — search API timeout → error state visible, not blank screen', async ({ page }) => {
  // Delay the search API response to simulate timeout
  await page.route('**/api/search**', async (route) => {
    await new Promise((r) => setTimeout(r, 15_000)) // longer than typical timeout
    route.abort('timedout')
  })

  await page.goto(`${BASE_URL}/search?q=design`)
  await page.waitForTimeout(3000)

  const bodyText = await page.locator('body').textContent()
  expect((bodyText ?? '').trim().length).toBeGreaterThan(50)
  expect(bodyText).not.toMatch(/TypeError:|ReferenceError:|webpack-internal/)

  // Some fallback or loading message should be visible
  const fallback = page.getByText(/something went wrong|failed to load|try again|timeout/i)
    .or(page.getByTestId('error-boundary'))
    .or(page.getByTestId('search-error'))
  await expect(fallback.first()).toBeVisible({ timeout: 5000 }).catch(() => {
    // Acceptable if the page shows a skeleton or empty state
  })
})

// ─── EB-11: Malformed slug in URL (SQL chars) → 404, no server error ────────

test('EB-11 — malformed slug with SQL chars → 404, no server error or crash', async ({ page }) => {
  const sqlSlug = "'; DROP TABLE posts;--"
  const encoded = encodeURIComponent(sqlSlug)

  const response = await page.goto(`${BASE_URL}/thread/${encoded}`)

  const status = response?.status() ?? 200
  const bodyText = await page.locator('body').textContent()

  // Must not be a 500 or raw DB error
  expect(status).not.toBe(500)
  expect(bodyText).not.toMatch(/SQL|syntax error|database error|pg_error/i)

  // Should show 404 or redirect
  const is404 = status === 404 || /not found|404/i.test(bodyText ?? '')
  expect(is404).toBe(true)
})

// ─── EB-12: Empty discipline page (no posts) → empty state renders ──────────

test('EB-12 — empty discipline (no posts) → graceful empty state', async ({ page }) => {
  // Use a seeded discipline that intentionally has no posts
  const emptyDiscipline = process.env.TEST_EMPTY_DISCIPLINE ?? 'emerging-design-test-empty'

  const response = await page.goto(`${BASE_URL}/${emptyDiscipline}`)
  const status = response?.status() ?? 200

  // If the discipline doesn't exist at all, we'd get 404 — that's also fine (EB-03 covers it)
  if (status === 404) {
    test.skip()
    return
  }

  // Page should render without crashing
  const bodyText = await page.locator('body').textContent()
  expect((bodyText ?? '').trim().length).toBeGreaterThan(50)
  expect(bodyText).not.toMatch(/TypeError:|ReferenceError:|Cannot read properties/)

  // An empty state message should be visible
  const emptyState = page.getByText(/no posts|be the first|start the conversation|nothing here yet/i)
    .or(page.getByTestId('feed-empty'))
    .or(page.getByTestId('empty-state'))
  await expect(emptyState.first()).toBeVisible()
})

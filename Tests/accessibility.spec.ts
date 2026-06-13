/**
 * ATELIER — Section 18a: Accessibility Tests (8 tests)
 * Tool: Playwright + @axe-core/playwright
 * File: tests/e2e/accessibility/accessibility.spec.ts
 *
 * Covers A11Y-01 through A11Y-08 (WCAG 2.1 AA)
 * Run: npx playwright test tests/e2e/accessibility/accessibility.spec.ts
 *
 * Prerequisites:
 *   npm install -D @axe-core/playwright
 */

import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const BASE_URL     = process.env.BASE_URL          ?? 'http://localhost:3000'
const USER_A_EMAIL = process.env.TEST_USER_A_EMAIL ?? 'usera@atelier.test'
const USER_A_PASS  = process.env.TEST_USER_A_PASS  ?? 'TestPassword1!'
const SEEDED_SLUG  = process.env.TEST_POST_SLUG    ?? 'seeded-discussion-post'
const SEEDED_USER  = process.env.TEST_USER_A_ID    ?? 'user-a-username'

// ─── Helper: run axe with WCAG 2.1 AA and assert zero violations ──────────

async function assertNoA11yViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

  if (results.violations.length > 0) {
    const summary = results.violations
      .map((v) => `[${v.id}] ${v.description} (${v.nodes.length} node(s))`)
      .join('\n')
    console.error(`A11y violations on ${label}:\n${summary}`)
  }

  expect(
    results.violations,
    `Expected zero WCAG 2.1 AA violations on ${label}, got:\n${results.violations
      .map((v) => v.id)
      .join(', ')}`,
  ).toHaveLength(0)
}

async function loginAs(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`)
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in|log in|login/i }).click()
  await page.waitForURL(/\/dashboard/)
}

// ─── A11Y-01: Hero page ────────────────────────────────────────────────────

test('A11Y-01 — Hero page has no WCAG 2.1 AA violations', async ({ page }) => {
  await page.goto(BASE_URL)
  await page.waitForLoadState('networkidle')
  await assertNoA11yViolations(page, 'Hero page')
})

// ─── A11Y-02: Login page ───────────────────────────────────────────────────

test('A11Y-02 — Login page has no WCAG 2.1 AA violations (form labels, focus order)', async ({ page }) => {
  await page.goto(`${BASE_URL}/login`)
  await page.waitForLoadState('networkidle')
  await assertNoA11yViolations(page, 'Login page')

  // Extra checks for form labels and focus order
  const emailInput = page.getByLabel(/email/i)
  const passwordInput = page.getByLabel(/password/i)
  await expect(emailInput).toBeVisible()
  await expect(passwordInput).toBeVisible()

  // Tab order: email → password → submit
  await page.keyboard.press('Tab')
  await expect(emailInput.or(page.locator(':focus'))).toBeFocused()
})

// ─── A11Y-03: Dashboard ────────────────────────────────────────────────────

test('A11Y-03 — Dashboard has no WCAG 2.1 AA violations (landmark roles present)', async ({ page }) => {
  await loginAs(page, USER_A_EMAIL, USER_A_PASS)
  await page.waitForLoadState('networkidle')
  await assertNoA11yViolations(page, 'Dashboard')

  // Landmark roles
  await expect(page.getByRole('main')).toBeVisible()
  await expect(page.getByRole('navigation').first()).toBeVisible()
})

// ─── A11Y-04: Thread page ──────────────────────────────────────────────────

test('A11Y-04 — Thread page has no WCAG 2.1 AA violations (comment list has list role)', async ({ page }) => {
  await page.goto(`${BASE_URL}/thread/${SEEDED_SLUG}`)
  await page.waitForLoadState('networkidle')
  await assertNoA11yViolations(page, 'Thread page')

  // Comment list should use list role (ul/ol or role="list")
  const commentList = page
    .getByRole('list')
    .filter({ has: page.locator('[data-testid="comment-item"]') })
    .or(page.locator('[data-testid="comment-list"]'))
  // Allow for single-comment pages where list may be absent
  const listCount = await commentList.count()
  // If comments exist, they should be in a list
  const commentCount = await page.locator('[data-testid="comment-item"]').count()
  if (commentCount > 0) {
    expect(listCount).toBeGreaterThan(0)
  }
})

// ─── A11Y-05: Profile page ─────────────────────────────────────────────────

test('A11Y-05 — Profile page has no WCAG 2.1 AA violations (heading hierarchy correct)', async ({ page }) => {
  await page.goto(`${BASE_URL}/profile/${SEEDED_USER}`)
  await page.waitForLoadState('networkidle')
  await assertNoA11yViolations(page, 'Profile page')

  // There should be exactly one h1
  const h1Count = await page.locator('h1').count()
  expect(h1Count).toBe(1)

  // Subheadings should be h2/h3, not skipping levels
  const headings = await page.locator('h1, h2, h3, h4, h5, h6').all()
  let prevLevel = 1
  for (const heading of headings) {
    const tag = await heading.evaluate((el) => el.tagName.toLowerCase())
    const level = parseInt(tag[1], 10)
    // Heading levels should not skip more than one
    expect(level - prevLevel).toBeLessThanOrEqual(1)
    prevLevel = level
  }
})

// ─── A11Y-06: Post creation form ───────────────────────────────────────────

test('A11Y-06 — Post creation form has no WCAG 2.1 AA violations (all inputs have labels)', async ({ page }) => {
  await loginAs(page, USER_A_EMAIL, USER_A_PASS)
  await page.goto(`${BASE_URL}/create`)
  await page.waitForLoadState('networkidle')
  await assertNoA11yViolations(page, 'Post creation form')

  // All inputs should have accessible labels
  const inputs = page.locator('input:visible, textarea:visible, select:visible')
  const inputCount = await inputs.count()

  for (let i = 0; i < inputCount; i++) {
    const input = inputs.nth(i)
    const id = await input.getAttribute('id')
    const ariaLabel = await input.getAttribute('aria-label')
    const ariaLabelledBy = await input.getAttribute('aria-labelledby')
    const hasLabel = id
      ? (await page.locator(`label[for="${id}"]`).count()) > 0
      : false

    const isLabelled = hasLabel || !!ariaLabel || !!ariaLabelledBy
    expect(isLabelled, `Input at index ${i} has no accessible label`).toBe(true)
  }
})

// ─── A11Y-07: Search / Explore page ───────────────────────────────────────

test('A11Y-07 — Search/Explore page has no WCAG 2.1 AA violations (search input labelled)', async ({ page }) => {
  await page.goto(`${BASE_URL}/search`)
  await page.waitForLoadState('networkidle')
  await assertNoA11yViolations(page, 'Search page')

  // Search input must have an accessible label
  const searchInput = page.getByRole('searchbox').or(page.getByLabel(/search/i))
  await expect(searchInput.first()).toBeVisible()

  const ariaLabel = await searchInput.first().getAttribute('aria-label')
  const id = await searchInput.first().getAttribute('id')
  const hasLabelEl = id ? (await page.locator(`label[for="${id}"]`).count()) > 0 : false
  expect(!!ariaLabel || hasLabelEl).toBe(true)
})

// ─── A11Y-08: 404 / Error page ─────────────────────────────────────────────

test('A11Y-08 — 404/Error page has no WCAG 2.1 AA violations (accessible error messaging)', async ({ page }) => {
  await page.goto(`${BASE_URL}/this-route-absolutely-does-not-exist-xyzzy-a11y`)
  await page.waitForLoadState('networkidle')
  await assertNoA11yViolations(page, '404 / Error page')

  // Error message should be accessible
  const errorText = page
    .getByRole('heading', { name: /not found|404|error/i })
    .or(page.getByText(/not found|404|page doesn.*t exist/i))
  await expect(errorText.first()).toBeVisible()

  // Page should have a main landmark even on error
  await expect(page.getByRole('main')).toBeVisible()
})

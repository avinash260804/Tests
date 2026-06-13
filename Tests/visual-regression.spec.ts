/**
 * ATELIER — Section 18b: Visual Regression Tests (6 tests)
 * Tool: Playwright screenshot comparison
 * File: tests/visual/visual-regression.spec.ts
 *
 * Covers VR-01 through VR-06
 * Run: npx playwright test tests/visual/visual-regression.spec.ts
 *
 * First run (baseline): snapshots are created in tests/visual/__snapshots__/
 * Subsequent runs: compared against baseline; diff > threshold = failure.
 *
 * Update snapshots: npx playwright test --update-snapshots
 */

import { test, expect, type Page } from '@playwright/test'

const BASE_URL     = process.env.BASE_URL          ?? 'http://localhost:3000'
const USER_A_EMAIL = process.env.TEST_USER_A_EMAIL ?? 'usera@atelier.test'
const USER_A_PASS  = process.env.TEST_USER_A_PASS  ?? 'TestPassword1!'
const SEEDED_SLUG  = process.env.TEST_POST_SLUG    ?? 'seeded-discussion-post'

/** Pixel-difference threshold (0–1). 0.02 = 2% of pixels may differ. */
const THRESHOLD = parseFloat(process.env.VR_THRESHOLD ?? '0.02')

/** Max allowed different pixels in the diff image */
const MAX_DIFF_PIXELS = parseInt(process.env.VR_MAX_DIFF ?? '500', 10)

// ─── Viewport presets ──────────────────────────────────────────────────────
const DESKTOP = { width: 1440, height: 900 }
const MOBILE  = { width: 390,  height: 844 }

// ─── Helpers ───────────────────────────────────────────────────────────────

async function loginAs(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`)
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in|log in|login/i }).click()
  await page.waitForURL(/\/dashboard/)
}

async function stabilisePage(page: Page) {
  // Wait for fonts, images and animations to settle
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  // Disable CSS transitions/animations for deterministic screenshots
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        transition-duration: 0s !important;
        animation-delay: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  })
}

function screenshotOptions() {
  return {
    threshold: THRESHOLD,
    maxDiffPixels: MAX_DIFF_PIXELS,
    animations: 'disabled' as const,
  }
}

// ─── VR-01: Hero page — desktop 1440×900 ──────────────────────────────────

test('VR-01 — Hero page desktop (1440×900) matches baseline', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await page.goto(BASE_URL)
  await stabilisePage(page)

  await expect(page).toHaveScreenshot('hero-page-desktop.png', screenshotOptions())
})

// ─── VR-02: Hero page — mobile 390×844 ────────────────────────────────────

test('VR-02 — Hero page mobile (390×844) matches baseline', async ({ page }) => {
  await page.setViewportSize(MOBILE)
  await page.goto(BASE_URL)
  await stabilisePage(page)

  await expect(page).toHaveScreenshot('hero-page-mobile.png', screenshotOptions())
})

// ─── VR-03: Dashboard — 1440×900, seeded profile data ─────────────────────

test('VR-03 — Dashboard (1440×900) with seeded profile data matches baseline', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await loginAs(page, USER_A_EMAIL, USER_A_PASS)
  await stabilisePage(page)

  // Hide dynamic time-based content (relative timestamps) to avoid flakes
  await page.addStyleTag({
    content: '[data-testid="timestamp"], time { visibility: hidden !important; }',
  })

  await expect(page).toHaveScreenshot('dashboard-desktop.png', screenshotOptions())
})

// ─── VR-04: Thread page — 1440×900, with 3 comments ──────────────────────

test('VR-04 — Thread page (1440×900) with comments matches baseline', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await page.goto(`${BASE_URL}/thread/${SEEDED_SLUG}`)
  await stabilisePage(page)

  await page.addStyleTag({
    content: '[data-testid="timestamp"], time { visibility: hidden !important; }',
  })

  await expect(page).toHaveScreenshot('thread-page-desktop.png', screenshotOptions())
})

// ─── VR-05: Profile page — 1440×900, full data ────────────────────────────

test('VR-05 — Profile page (1440×900) full data matches baseline', async ({ page }) => {
  const username = process.env.TEST_USER_A_USERNAME ?? 'usera'

  await page.setViewportSize(DESKTOP)
  await page.goto(`${BASE_URL}/profile/${username}`)
  await stabilisePage(page)

  await page.addStyleTag({
    content: '[data-testid="timestamp"], time { visibility: hidden !important; }',
  })

  await expect(page).toHaveScreenshot('profile-page-desktop.png', screenshotOptions())
})

// ─── VR-06: Post creation form — 1440×900, empty state ───────────────────

test('VR-06 — Post creation form (1440×900) empty state matches baseline', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await loginAs(page, USER_A_EMAIL, USER_A_PASS)
  await page.goto(`${BASE_URL}/create`)
  await stabilisePage(page)

  await expect(page).toHaveScreenshot('post-create-form-desktop.png', screenshotOptions())
})

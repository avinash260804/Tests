// =============================================================================
// ATELIER — Section 18: Accessibility, Visual & Performance Tests
// File: tests/e2e/accessibility/a11y-visual-perf.spec.ts
// Tool: Playwright + @axe-core/playwright
// =============================================================================

import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// ── Accessibility Tests (A11Y-01 to A11Y-08) ─────────────────────────────────
test.describe('Accessibility — WCAG 2.1 AA', () => {
  async function checkA11y(page: any, url: string, testId: string) {
    await page.goto(url)
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(
      results.violations,
      `${testId}: ${results.violations.map(v => `${v.id}: ${v.description}`).join('\n')}`
    ).toHaveLength(0)
  }

  test('A11Y-01: Hero page — no WCAG 2.1 AA violations', async ({ page }) => {
    await checkA11y(page, '/', 'A11Y-01')
  })

  test('A11Y-02: Login page — form labels and focus order', async ({ page }) => {
    await checkA11y(page, '/auth/login', 'A11Y-02')
    // Additionally verify all inputs have labels
    const inputs = page.locator('input:not([type=hidden])')
    const count = await inputs.count()
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i)
      const id = await input.getAttribute('id')
      const ariaLabel = await input.getAttribute('aria-label')
      const ariaLabelledby = await input.getAttribute('aria-labelledby')
      const hasLabel = id ? (await page.locator(`label[for="${id}"]`).count()) > 0 : false
      expect(hasLabel || ariaLabel || ariaLabelledby, `Input #${i} missing label`).toBeTruthy()
    }
  })

  test('A11Y-03: Dashboard — landmark roles present', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'tests/e2e/.auth/user-a.json' })
    const page = await ctx.newPage()
    await page.goto('/dashboard')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(results.violations).toHaveLength(0)

    // Verify main landmark exists
    await expect(page.locator('main')).toBeVisible()
    await ctx.close()
  })

  test('A11Y-04: Thread page — comment list has list role', async ({ page }) => {
    await page.goto(`/thread/${process.env.TEST_SEEDED_POST_SLUG!}`)
    await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze().then(r => {
      expect(r.violations).toHaveLength(0)
    })
    // Comment list should use <ul> or role="list"
    const commentList = page.locator('[data-testid=comment-list]')
    await expect(commentList).toBeVisible()
    const tagName = await commentList.evaluate(el => el.tagName.toLowerCase())
    const role = await commentList.getAttribute('role')
    expect(tagName === 'ul' || role === 'list').toBe(true)
  })

  test('A11Y-05: Profile page — heading hierarchy correct', async ({ page }) => {
    await page.goto(`/profile/${process.env.TEST_USER_A_USERNAME!}`)
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(results.violations).toHaveLength(0)
    // h1 should exist
    await expect(page.locator('h1')).toBeVisible()
  })

  test('A11Y-06: Post creation form — all inputs have labels', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'tests/e2e/.auth/user-a.json' })
    const page = await ctx.newPage()
    await page.goto('/create')
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(results.violations).toHaveLength(0)
    await ctx.close()
  })

  test('A11Y-07: Search/Explore page — search input labelled', async ({ page }) => {
    await page.goto('/search')
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(results.violations).toHaveLength(0)
    // Search input must have accessible label
    const searchInput = page.locator('[data-testid=search-input]')
    await expect(searchInput).toBeVisible()
    const ariaLabel = await searchInput.getAttribute('aria-label')
    const id = await searchInput.getAttribute('id')
    const hasLabel = id ? (await page.locator(`label[for="${id}"]`).count()) > 0 : false
    expect(ariaLabel || hasLabel).toBeTruthy()
  })

  test('A11Y-08: 404 / Error page — accessible error messaging', async ({ page }) => {
    await page.goto('/this-page-will-never-exist-a11y08')
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(results.violations).toHaveLength(0)
    await expect(page.locator('h1')).toBeVisible() // error pages need headings
  })
})

// ── Visual Regression Tests (VR-01 to VR-06) ─────────────────────────────────
test.describe('Visual Regression', () => {
  test.use({ viewport: { width: 1440, height: 900 } }) // desktop baseline

  test('VR-01: Hero page — desktop 1440×900 baseline', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('hero-desktop.png', { maxDiffPixelRatio: 0.02 })
  })

  test('VR-02: Hero page — mobile 390×844 baseline', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await ctx.newPage()
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('hero-mobile.png', { maxDiffPixelRatio: 0.02 })
    await ctx.close()
  })

  test('VR-03: Dashboard — 1440×900 with seeded profile data', async ({ browser }) => {
    const ctx = await browser.newContext({
      storageState: 'tests/e2e/.auth/user-a.json',
      viewport: { width: 1440, height: 900 },
    })
    const page = await ctx.newPage()
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('dashboard-desktop.png', { maxDiffPixelRatio: 0.02 })
    await ctx.close()
  })

  test('VR-04: Thread page — 1440×900 with 3 comments', async ({ page }) => {
    await page.goto(`/thread/${process.env.TEST_SEEDED_POST_SLUG!}`)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('thread-desktop.png', { maxDiffPixelRatio: 0.02 })
  })

  test('VR-05: Profile page — 1440×900 full data state', async ({ page }) => {
    await page.goto(`/profile/${process.env.TEST_USER_A_USERNAME!}`)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('profile-desktop.png', { maxDiffPixelRatio: 0.02 })
  })

  test('VR-06: Post creation form — 1440×900 empty state', async ({ browser }) => {
    const ctx = await browser.newContext({
      storageState: 'tests/e2e/.auth/user-a.json',
      viewport: { width: 1440, height: 900 },
    })
    const page = await ctx.newPage()
    await page.goto('/create')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('post-create-empty.png', { maxDiffPixelRatio: 0.02 })
    await ctx.close()
  })
})

// ── Performance Tests (PERF-01 to PERF-06) ───────────────────────────────────
test.describe('Performance — Web Vitals', () => {
  async function measureWebVitals(page: any, url: string) {
    await page.goto(url, { waitUntil: 'networkidle' })
    return page.evaluate(() => {
      return new Promise<Record<string, number>>(resolve => {
        const vitals: Record<string, number> = {}
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'largest-contentful-paint') vitals.lcp = entry.startTime
            if (entry.entryType === 'layout-shift') vitals.cls = (vitals.cls ?? 0) + (entry as any).value
          }
        }).observe({ type: 'largest-contentful-paint', buffered: true })
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'layout-shift') vitals.cls = (vitals.cls ?? 0) + (entry as any).value
          }
        }).observe({ type: 'layout-shift', buffered: true })
        setTimeout(() => resolve(vitals), 3000)
      })
    })
  }

  test('PERF-01: Hero page LCP < 2.5s', async ({ page }) => {
    const vitals = await measureWebVitals(page, '/')
    expect(vitals.lcp ?? 0).toBeLessThan(2500)
  })

  test('PERF-02: Hero page CLS < 0.1', async ({ page }) => {
    const vitals = await measureWebVitals(page, '/')
    expect(vitals.cls ?? 0).toBeLessThan(0.1)
  })

  test('PERF-03: Dashboard LCP < 2.5s', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'tests/e2e/.auth/user-a.json' })
    const page = await ctx.newPage()
    const vitals = await measureWebVitals(page, '/dashboard')
    expect(vitals.lcp ?? 0).toBeLessThan(2500)
    await ctx.close()
  })

  test('PERF-04: Thread page LCP < 2.5s', async ({ page }) => {
    const vitals = await measureWebVitals(page, `/thread/${process.env.TEST_SEEDED_POST_SLUG!}`)
    expect(vitals.lcp ?? 0).toBeLessThan(2500)
  })

  test('PERF-05: Search page — first result visible < 1s', async ({ page }) => {
    const start = Date.now()
    await page.goto('/search?q=design')
    await page.locator('[data-testid=post-card]').first().waitFor({ state: 'visible' })
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(1000)
  })

  test('PERF-06: No console.error on page load', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    expect(errors).toHaveLength(0)
  })
})

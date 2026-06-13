/**
 * ATELIER — Section 18c: Performance Tests (6 tests)
 * Tool: Playwright + web-vitals
 * File: tests/e2e/performance/performance.spec.ts
 *
 * Covers PERF-01 through PERF-06
 * Run: npx playwright test tests/e2e/performance/performance.spec.ts
 *
 * Thresholds (per suite spec):
 *   LCP  < 2500ms
 *   CLS  < 0.1
 *   Time to first result visible < 1000ms
 *   Zero console.error on page load
 *
 * Prerequisites:
 *   - npm install -D playwright
 *   - Local dev server OR staging URL via BASE_URL env
 *   - Seeded database (npx prisma db seed)
 */

import { test, expect, type Page, type ConsoleMessage } from '@playwright/test'

const BASE_URL     = process.env.BASE_URL          ?? 'http://localhost:3000'
const USER_A_EMAIL = process.env.TEST_USER_A_EMAIL ?? 'usera@atelier.test'
const USER_A_PASS  = process.env.TEST_USER_A_PASS  ?? 'TestPassword1!'
const SEEDED_SLUG  = process.env.TEST_POST_SLUG    ?? 'seeded-discussion-post'

const LCP_THRESHOLD  = parseInt(process.env.PERF_LCP_MS  ?? '2500', 10)
const CLS_THRESHOLD  = parseFloat(process.env.PERF_CLS   ?? '0.1')
const FIRST_RESULT_THRESHOLD = parseInt(process.env.PERF_FIRST_RESULT_MS ?? '1000', 10)

// ─── Helpers ───────────────────────────────────────────────────────────────

async function loginAs(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`)
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in|log in|login/i }).click()
  await page.waitForURL(/\/dashboard/)
}

/**
 * Inject the web-vitals library (unpkg CDN) and collect LCP + CLS
 * by observing PerformanceObserver entries after navigation.
 *
 * Returns { lcp: number, cls: number }
 */
async function collectWebVitals(page: Page): Promise<{ lcp: number; cls: number }> {
  // Wait for the page to be fully interactive before sampling
  await page.waitForLoadState('networkidle')

  const vitals = await page.evaluate((): Promise<{ lcp: number; cls: number }> => {
    return new Promise((resolve) => {
      let lcpValue = 0
      let clsValue = 0

      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        for (const entry of entries) {
          lcpValue = (entry as PerformanceEntry & { renderTime?: number; loadTime?: number })
            .renderTime ||
            (entry as PerformanceEntry & { loadTime?: number }).loadTime ||
            entry.startTime
        }
      })

      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const layoutShift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number }
          if (!layoutShift.hadRecentInput) {
            clsValue += layoutShift.value ?? 0
          }
        }
      })

      try {
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })
        clsObserver.observe({ type: 'layout-shift', buffered: true })
      } catch {
        // Browser may not support all entry types
      }

      // Sample after 3 seconds (enough for LCP to fire on fast local server)
      setTimeout(() => {
        lcpObserver.disconnect()
        clsObserver.disconnect()
        resolve({ lcp: lcpValue, cls: clsValue })
      }, 3000)
    })
  })

  return vitals
}

/** Collect all console.error messages emitted during page load */
function attachErrorCollector(page: Page): () => string[] {
  const errors: string[] = []
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })
  page.on('pageerror', (err: Error) => {
    errors.push(`[pageerror] ${err.message}`)
  })
  return () => errors
}

// ─── PERF-01: Hero page — LCP < 2.5s ─────────────────────────────────────

test('PERF-01 — Hero page LCP < 2500ms', async ({ page }) => {
  const getErrors = attachErrorCollector(page)

  await page.goto(BASE_URL, { waitUntil: 'load' })
  const { lcp } = await collectWebVitals(page)

  console.log(`PERF-01 LCP: ${lcp}ms`)
  expect(lcp, `LCP ${lcp}ms exceeds threshold of ${LCP_THRESHOLD}ms`).toBeLessThan(LCP_THRESHOLD)
})

// ─── PERF-02: Hero page — CLS < 0.1 ──────────────────────────────────────

test('PERF-02 — Hero page CLS < 0.1', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'load' })
  const { cls } = await collectWebVitals(page)

  console.log(`PERF-02 CLS: ${cls}`)
  expect(cls, `CLS ${cls} exceeds threshold of ${CLS_THRESHOLD}`).toBeLessThan(CLS_THRESHOLD)
})

// ─── PERF-03: Dashboard — LCP < 2.5s ─────────────────────────────────────

test('PERF-03 — Dashboard LCP < 2500ms', async ({ page }) => {
  await loginAs(page, USER_A_EMAIL, USER_A_PASS)

  // Navigate fresh to dashboard to reset performance timeline
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'load' })
  const { lcp } = await collectWebVitals(page)

  console.log(`PERF-03 Dashboard LCP: ${lcp}ms`)
  expect(lcp, `Dashboard LCP ${lcp}ms exceeds ${LCP_THRESHOLD}ms`).toBeLessThan(LCP_THRESHOLD)
})

// ─── PERF-04: Thread page — LCP < 2.5s ───────────────────────────────────

test('PERF-04 — Thread page LCP < 2500ms', async ({ page }) => {
  await page.goto(`${BASE_URL}/thread/${SEEDED_SLUG}`, { waitUntil: 'load' })
  const { lcp } = await collectWebVitals(page)

  console.log(`PERF-04 Thread LCP: ${lcp}ms`)
  expect(lcp, `Thread LCP ${lcp}ms exceeds ${LCP_THRESHOLD}ms`).toBeLessThan(LCP_THRESHOLD)
})

// ─── PERF-05: Search page — first result visible < 1s ────────────────────

test('PERF-05 — Search page: first result visible within 1000ms on seeded DB', async ({ page }) => {
  const startTime = Date.now()

  await page.goto(`${BASE_URL}/search?q=design`, { waitUntil: 'domcontentloaded' })

  // Wait for the first search result to appear in DOM
  await page.waitForSelector(
    '[data-testid="post-card"], [data-testid="search-result"], [data-testid="post-list-item"]',
    { timeout: FIRST_RESULT_THRESHOLD + 2000 }, // extra buffer for slow CI
  )

  const elapsed = Date.now() - startTime
  console.log(`PERF-05 first result visible: ${elapsed}ms`)
  expect(elapsed, `First result took ${elapsed}ms, threshold is ${FIRST_RESULT_THRESHOLD}ms`)
    .toBeLessThan(FIRST_RESULT_THRESHOLD)
})

// ─── PERF-06: Any page — zero console.error on load ──────────────────────

test('PERF-06 — No console.error on any page load', async ({ page }) => {
  const pages = [
    BASE_URL,
    `${BASE_URL}/login`,
    `${BASE_URL}/thread/${SEEDED_SLUG}`,
    `${BASE_URL}/search?q=design`,
    `${BASE_URL}/explore`,
  ]

  const allErrors: { url: string; errors: string[] }[] = []

  for (const url of pages) {
    const errors: string[] = []
    const handler = (msg: ConsoleMessage) => {
      if (msg.type() === 'error') errors.push(msg.text())
    }
    const errHandler = (err: Error) => errors.push(`[pageerror] ${err.message}`)

    page.on('console', handler)
    page.on('pageerror', errHandler)

    await page.goto(url, { waitUntil: 'networkidle' })

    page.off('console', handler)
    page.off('pageerror', errHandler)

    if (errors.length > 0) {
      allErrors.push({ url, errors })
    }
  }

  if (allErrors.length > 0) {
    const report = allErrors
      .map(({ url, errors }) => `${url}:\n  ${errors.join('\n  ')}`)
      .join('\n')
    throw new Error(`console.error found on page load:\n${report}`)
  }

  expect(allErrors).toHaveLength(0)
})

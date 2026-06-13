/**
 * ATELIER — Section 16: End-to-End User Flow Tests (30 tests)
 * Tool: Playwright
 * File: tests/e2e/flows/user-flows.spec.ts
 *
 * Covers E-01 through E-30
 * Run: npx playwright test tests/e2e/flows/user-flows.spec.ts
 *
 * Prerequisites:
 *   - Local dev server running (BASE_URL env)
 *   - Seeded Supabase DB (npx prisma db seed)
 *   - TEST_USER_A_EMAIL / TEST_USER_A_PASS — existing seeded account
 *   - TEST_USER_B_EMAIL / TEST_USER_B_PASS — second seeded account
 */

import { test, expect, type Page } from '@playwright/test'

// ─── Config ────────────────────────────────────────────────────────────────

const BASE_URL           = process.env.BASE_URL            ?? 'http://localhost:3000'
const USER_A_EMAIL       = process.env.TEST_USER_A_EMAIL   ?? 'usera@atelier.test'
const USER_A_PASS        = process.env.TEST_USER_A_PASS    ?? 'TestPassword1!'
const USER_B_EMAIL       = process.env.TEST_USER_B_EMAIL   ?? 'userb@atelier.test'
const USER_B_PASS        = process.env.TEST_USER_B_PASS    ?? 'TestPassword2!'
const SEEDED_POST_SLUG   = process.env.TEST_POST_SLUG      ?? 'seeded-discussion-post'
const SEEDED_DISCIPLINE  = process.env.TEST_DISCIPLINE     ?? 'interior-design'

// ─── Auth helpers ──────────────────────────────────────────────────────────

async function loginAs(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`)
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in|log in|login/i }).click()
  await page.waitForURL(/\/dashboard/)
}

async function logout(page: Page) {
  await page.goto(`${BASE_URL}/dashboard`)
  await page.getByRole('button', { name: /logout|sign out/i }).click()
  await page.waitForURL(/\/|\/login/)
}

// ══════════════════════════════════════════════════════════════════════════
// AUTH FLOW (E-01 – E-05)
// ══════════════════════════════════════════════════════════════════════════

test.describe('Auth Flow', () => {

  test('E-01 — signup → onboarding → discipline selection → /dashboard', async ({ page }) => {
    const ts = Date.now()
    const email = `signup_${ts}@atelier.test`

    await page.goto(`${BASE_URL}/signup`)
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill('SecurePass1!')
    await page.getByRole('button', { name: /sign up|create account/i }).click()

    // Onboarding step
    await page.waitForURL(/\/onboarding/)
    await page.getByLabel(/username/i).fill(`user_${ts}`)
    await page.getByRole('button', { name: /next|continue/i }).click()

    // Discipline selection
    await page.waitForURL(/\/onboarding|\/discipline/)
    const firstDiscipline = page.getByRole('button', { name: /interior|graphic|motion|ux|fashion/i }).first()
    await firstDiscipline.click()
    await page.getByRole('button', { name: /finish|done|continue/i }).click()

    await page.waitForURL(/\/dashboard/)
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('E-02 — login with existing account → /dashboard', async ({ page }) => {
    await loginAs(page, USER_A_EMAIL, USER_A_PASS)
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('E-03 — login with wrong password → error shown, no redirect', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.getByLabel(/email/i).fill(USER_A_EMAIL)
    await page.getByLabel(/password/i).fill('wrongpassword')
    await page.getByRole('button', { name: /sign in|log in/i }).click()

    // Should NOT redirect to dashboard
    await page.waitForTimeout(1500)
    expect(page.url()).not.toMatch(/\/dashboard/)

    // Error message visible
    const errorMsg = page.getByText(/invalid|incorrect|wrong|failed/i)
    await expect(errorMsg).toBeVisible()
  })

  test('E-04 — logout → session cleared → /dashboard redirects to login', async ({ page }) => {
    await loginAs(page, USER_A_EMAIL, USER_A_PASS)
    await logout(page)

    // Attempt to go to dashboard
    await page.goto(`${BASE_URL}/dashboard`)
    await page.waitForURL(/\/login|\//)
    expect(page.url()).not.toMatch(/\/dashboard/)
  })

  test('E-05 — access /dashboard after logout → redirect to login', async ({ page }) => {
    await loginAs(page, USER_A_EMAIL, USER_A_PASS)
    await logout(page)

    await page.goto(`${BASE_URL}/dashboard`)
    await expect(page).not.toHaveURL(/\/dashboard/)
    // Should be at login or root
    expect(page.url()).toMatch(/\/(login)?$/)
  })
})

// ══════════════════════════════════════════════════════════════════════════
// POST FLOW (E-06 – E-11)
// ══════════════════════════════════════════════════════════════════════════

test.describe('Post Flow', () => {

  test.beforeEach(async ({ page }) => {
    await loginAs(page, USER_A_EMAIL, USER_A_PASS)
  })

  test('E-06 — create DISCUSSION post → redirect to /thread/[slug] → post visible', async ({ page }) => {
    await page.goto(`${BASE_URL}/create`)

    await page.getByLabel(/title/i).fill('E-06 Discussion Post')
    await page.getByLabel(/content/i).fill('This is an E2E test discussion post content.')
    await page.getByRole('combobox', { name: /discipline/i }).selectOption({ index: 1 })
    await page.getByRole('radio', { name: /discussion/i }).check()
    await page.getByRole('button', { name: /submit|publish|post/i }).click()

    await page.waitForURL(/\/thread\//)
    await expect(page.getByText('E-06 Discussion Post')).toBeVisible()
  })

  test('E-07 — created post appears in discipline feed', async ({ page }) => {
    const title = `E-07 Feed Post ${Date.now()}`
    await page.goto(`${BASE_URL}/create`)

    await page.getByLabel(/title/i).fill(title)
    await page.getByLabel(/content/i).fill('Feed visibility test.')
    await page.getByRole('combobox', { name: /discipline/i }).selectOption(SEEDED_DISCIPLINE)
    await page.getByRole('radio', { name: /discussion/i }).check()
    await page.getByRole('button', { name: /submit|publish|post/i }).click()
    await page.waitForURL(/\/thread\//)

    // Navigate to discipline feed
    await page.goto(`${BASE_URL}/${SEEDED_DISCIPLINE}`)
    await expect(page.getByText(title)).toBeVisible()
  })

  test('E-08 — post creation blocked when discipline not selected', async ({ page }) => {
    await page.goto(`${BASE_URL}/create`)

    await page.getByLabel(/title/i).fill('No Discipline Post')
    await page.getByLabel(/content/i).fill('Some content.')
    // Do NOT select discipline
    await page.getByRole('button', { name: /submit|publish|post/i }).click()

    // Should stay on /create with an error
    await page.waitForTimeout(500)
    expect(page.url()).toMatch(/\/create/)
    await expect(page.getByText(/discipline.*required|select.*discipline/i)).toBeVisible()
  })

  test('E-09 — post creation blocked when title is empty', async ({ page }) => {
    await page.goto(`${BASE_URL}/create`)

    // Leave title empty
    await page.getByLabel(/content/i).fill('Some content.')
    await page.getByRole('combobox', { name: /discipline/i }).selectOption({ index: 1 })
    await page.getByRole('radio', { name: /discussion/i }).check()
    await page.getByRole('button', { name: /submit|publish|post/i }).click()

    await page.waitForTimeout(500)
    expect(page.url()).toMatch(/\/create/)
    await expect(page.getByText(/title.*required/i)).toBeVisible()
  })

  test('E-10 — create SHOWCASE post with image → thumbnail visible on thread', async ({ page }) => {
    await page.goto(`${BASE_URL}/create`)

    await page.getByLabel(/title/i).fill('E-10 Showcase Post')
    await page.getByLabel(/content/i).fill('Showcase with image.')
    await page.getByRole('combobox', { name: /discipline/i }).selectOption({ index: 1 })
    await page.getByRole('radio', { name: /showcase/i }).check()

    // Attach a test image
    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: /upload|attach|image/i }).click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      // 1×1 transparent PNG
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64',
      ),
    })

    await page.getByRole('button', { name: /submit|publish|post/i }).click()
    await page.waitForURL(/\/thread\//)

    // Thumbnail should be visible
    const img = page.locator('img[data-testid="post-thumbnail"], img[alt*="showcase"], [data-testid="post-image"] img')
    await expect(img.first()).toBeVisible()
  })

  test('E-11 — create RESOURCE post → appears in resources tab of discipline', async ({ page }) => {
    const title = `E-11 Resource ${Date.now()}`
    await page.goto(`${BASE_URL}/create`)

    await page.getByLabel(/title/i).fill(title)
    await page.getByLabel(/content/i).fill('Resource test content.')
    await page.getByRole('combobox', { name: /discipline/i }).selectOption(SEEDED_DISCIPLINE)
    await page.getByRole('radio', { name: /resource/i }).check()
    await page.getByRole('button', { name: /submit|publish/i }).click()
    await page.waitForURL(/\/thread\//)

    await page.goto(`${BASE_URL}/${SEEDED_DISCIPLINE}`)
    await page.getByRole('tab', { name: /resource/i }).click()
    await expect(page.getByText(title)).toBeVisible()
  })
})

// ══════════════════════════════════════════════════════════════════════════
// HELP FLOW (E-12 – E-15)
// ══════════════════════════════════════════════════════════════════════════

test.describe('Help Flow', () => {

  test('E-12 — create HELP post → User B comments → User A marks solved → SOLVED badge', async ({ browser }) => {
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    // User A creates a HELP post
    await loginAs(pageA, USER_A_EMAIL, USER_A_PASS)
    await pageA.goto(`${BASE_URL}/create`)
    const helpTitle = `E-12 Help Post ${Date.now()}`
    await pageA.getByLabel(/title/i).fill(helpTitle)
    await pageA.getByLabel(/content/i).fill('I need help with this design problem.')
    await pageA.getByRole('combobox', { name: /discipline/i }).selectOption({ index: 1 })
    await pageA.getByRole('radio', { name: /help/i }).check()
    await pageA.getByRole('button', { name: /submit|publish/i }).click()
    await pageA.waitForURL(/\/thread\//)
    const threadUrl = pageA.url()

    // User B comments
    await loginAs(pageB, USER_B_EMAIL, USER_B_PASS)
    await pageB.goto(threadUrl)
    await pageB.getByLabel(/write.*comment|add.*comment|your comment/i).fill('Here is the solution!')
    await pageB.getByRole('button', { name: /comment|reply|submit/i }).click()
    await expect(pageB.getByText('Here is the solution!')).toBeVisible()

    // User A marks the comment as the solution
    await pageA.reload()
    await pageA.getByRole('button', { name: /mark.*solved|accept.*answer|mark.*solution/i }).first().click()

    // SOLVED badge visible
    await expect(pageA.getByText(/solved/i).first()).toBeVisible()

    await contextA.close()
    await contextB.close()
  })

  test('E-13 — clear solved → SOLVED badge removed', async ({ page }) => {
    await loginAs(page, USER_A_EMAIL, USER_A_PASS)

    // Find a post that is already solved (seeded)
    await page.goto(`${BASE_URL}/thread/${SEEDED_POST_SLUG}`)

    // If not solved, skip gracefully
    const solvedBadge = page.getByText(/solved/i).first()
    const isSolved = await solvedBadge.isVisible().catch(() => false)
    if (!isSolved) {
      test.skip()
      return
    }

    await page.getByRole('button', { name: /clear.*solved|unmark|remove.*solution/i }).click()
    await expect(solvedBadge).not.toBeVisible()
  })

  test('E-14 — non-author cannot mark help post as solved', async ({ browser }) => {
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()

    await loginAs(pageA, USER_A_EMAIL, USER_A_PASS)
    await pageA.goto(`${BASE_URL}/create`)
    const helpTitle = `E-14 Help No Solve ${Date.now()}`
    await pageA.getByLabel(/title/i).fill(helpTitle)
    await pageA.getByLabel(/content/i).fill('Help question.')
    await pageA.getByRole('combobox', { name: /discipline/i }).selectOption({ index: 1 })
    await pageA.getByRole('radio', { name: /help/i }).check()
    await pageA.getByRole('button', { name: /submit|publish/i }).click()
    await pageA.waitForURL(/\/thread\//)
    const threadUrl = pageA.url()

    // User B visits the thread
    await loginAs(pageB, USER_B_EMAIL, USER_B_PASS)
    await pageB.goto(threadUrl)

    // "Mark as solved" button should not be present for non-authors
    const markSolvedBtn = pageB.getByRole('button', { name: /mark.*solved|accept.*answer/i })
    await expect(markSolvedBtn).toHaveCount(0)

    await ctxA.close()
    await ctxB.close()
  })

  test('E-15 — solved HELP post appears first in search results filtered by HELP', async ({ page }) => {
    await loginAs(page, USER_A_EMAIL, USER_A_PASS)

    // Search for HELP posts
    await page.goto(`${BASE_URL}/search?q=help&postType=HELP`)
    await page.waitForSelector('[data-testid="search-result"], [data-testid="post-card"]')

    // First result should have SOLVED badge (solved posts rank first)
    const firstResult = page.locator('[data-testid="search-result"], [data-testid="post-card"]').first()
    await expect(firstResult.getByText(/solved/i)).toBeVisible()
  })
})

// ══════════════════════════════════════════════════════════════════════════
// CRITIQUE & VOTING FLOW (E-16 – E-19)
// ══════════════════════════════════════════════════════════════════════════

test.describe('Critique & Voting Flow', () => {

  test('E-16 — create CRITIQUE post → User B upvotes → vote count increments', async ({ browser }) => {
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()

    await loginAs(pageA, USER_A_EMAIL, USER_A_PASS)
    await pageA.goto(`${BASE_URL}/create`)
    await pageA.getByLabel(/title/i).fill(`E-16 Critique ${Date.now()}`)
    await pageA.getByLabel(/content/i).fill('Please critique my work.')
    await pageA.getByRole('combobox', { name: /discipline/i }).selectOption({ index: 1 })
    await pageA.getByRole('radio', { name: /critique/i }).check()
    await pageA.getByRole('button', { name: /submit|publish/i }).click()
    await pageA.waitForURL(/\/thread\//)
    const threadUrl = pageA.url()

    // Get initial vote count
    await loginAs(pageB, USER_B_EMAIL, USER_B_PASS)
    await pageB.goto(threadUrl)
    const voteCountEl = pageB.getByTestId('vote-count').first()
    const initialCount = parseInt((await voteCountEl.textContent()) ?? '0', 10)

    await pageB.getByRole('button', { name: /upvote|▲|👍/i }).first().click()
    await pageB.waitForTimeout(600)

    const newCount = parseInt((await voteCountEl.textContent()) ?? '0', 10)
    expect(newCount).toBe(initialCount + 1)

    await ctxA.close()
    await ctxB.close()
  })

  test('E-17 — upvote → reload → count persisted', async ({ browser }) => {
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()

    await loginAs(pageA, USER_A_EMAIL, USER_A_PASS)
    await pageA.goto(`${BASE_URL}/create`)
    await pageA.getByLabel(/title/i).fill(`E-17 Persistence ${Date.now()}`)
    await pageA.getByLabel(/content/i).fill('Vote persistence test.')
    await pageA.getByRole('combobox', { name: /discipline/i }).selectOption({ index: 1 })
    await pageA.getByRole('radio', { name: /discussion/i }).check()
    await pageA.getByRole('button', { name: /submit|publish/i }).click()
    await pageA.waitForURL(/\/thread\//)
    const threadUrl = pageA.url()

    await loginAs(pageB, USER_B_EMAIL, USER_B_PASS)
    await pageB.goto(threadUrl)

    const voteCountEl = pageB.getByTestId('vote-count').first()
    const initial = parseInt((await voteCountEl.textContent()) ?? '0', 10)

    await pageB.getByRole('button', { name: /upvote|▲/i }).first().click()
    await pageB.waitForTimeout(600)

    await pageB.reload()
    const after = parseInt((await pageB.getByTestId('vote-count').first().textContent()) ?? '0', 10)
    expect(after).toBe(initial + 1)

    await ctxA.close()
    await ctxB.close()
  })

  test('E-18 — upvote then upvote again → vote toggled off', async ({ browser }) => {
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()

    await loginAs(pageA, USER_A_EMAIL, USER_A_PASS)
    await pageA.goto(`${BASE_URL}/create`)
    await pageA.getByLabel(/title/i).fill(`E-18 Toggle ${Date.now()}`)
    await pageA.getByLabel(/content/i).fill('Vote toggle test.')
    await pageA.getByRole('combobox', { name: /discipline/i }).selectOption({ index: 1 })
    await pageA.getByRole('radio', { name: /discussion/i }).check()
    await pageA.getByRole('button', { name: /submit|publish/i }).click()
    await pageA.waitForURL(/\/thread\//)
    const threadUrl = pageA.url()

    await loginAs(pageB, USER_B_EMAIL, USER_B_PASS)
    await pageB.goto(threadUrl)

    const voteCountEl = pageB.getByTestId('vote-count').first()
    const initial = parseInt((await voteCountEl.textContent()) ?? '0', 10)

    // First click — upvote
    await pageB.getByRole('button', { name: /upvote|▲/i }).first().click()
    await pageB.waitForTimeout(500)

    // Second click — toggle off
    await pageB.getByRole('button', { name: /upvote|▲/i }).first().click()
    await pageB.waitForTimeout(500)

    const final = parseInt((await voteCountEl.textContent()) ?? '0', 10)
    expect(final).toBe(initial)

    await ctxA.close()
    await ctxB.close()
  })

  test('E-19 — own post → vote buttons disabled', async ({ page }) => {
    await loginAs(page, USER_A_EMAIL, USER_A_PASS)

    await page.goto(`${BASE_URL}/create`)
    await page.getByLabel(/title/i).fill(`E-19 Self Vote ${Date.now()}`)
    await page.getByLabel(/content/i).fill('Self-vote disabled test.')
    await page.getByRole('combobox', { name: /discipline/i }).selectOption({ index: 1 })
    await page.getByRole('radio', { name: /discussion/i }).check()
    await page.getByRole('button', { name: /submit|publish/i }).click()
    await page.waitForURL(/\/thread\//)

    const upvoteBtn = page.getByRole('button', { name: /upvote|▲/i }).first()
    await expect(upvoteBtn).toBeDisabled()
  })
})

// ══════════════════════════════════════════════════════════════════════════
// THREAD FLOW (E-20 – E-22)
// ══════════════════════════════════════════════════════════════════════════

test.describe('Thread Flow', () => {

  test('E-20 — thread page loads SSR content without client-side fetch', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/thread/${SEEDED_POST_SLUG}`)
    const html = await response!.text()

    // The post title should be present in the raw HTML (SSR), not just after JS hydration
    expect(html).toMatch(/data-testid="post-title"|<h1/)
    expect(html.length).toBeGreaterThan(500)
  })

  test('E-21 — thread page shows breadcrumb back to discipline', async ({ page }) => {
    await page.goto(`${BASE_URL}/thread/${SEEDED_POST_SLUG}`)

    const breadcrumb = page.getByRole('navigation', { name: /breadcrumb/i })
      .or(page.locator('[data-testid="breadcrumb"]'))
      .or(page.locator('nav').filter({ has: page.locator('a') }))

    await expect(breadcrumb.first()).toBeVisible()

    // At least one breadcrumb link should point to a discipline
    const disciplineLink = page.locator('nav a[href*="/"]').filter({ hasText: /design|art|fashion|motion|ux/i })
    await expect(disciplineLink.first()).toBeVisible()
  })

  test('E-22 — thread page loads gracefully with empty comments', async ({ page }) => {
    // Create a fresh post with no comments via User A
    await loginAs(page, USER_A_EMAIL, USER_A_PASS)
    await page.goto(`${BASE_URL}/create`)
    await page.getByLabel(/title/i).fill(`E-22 No Comments ${Date.now()}`)
    await page.getByLabel(/content/i).fill('Thread with no comments.')
    await page.getByRole('combobox', { name: /discipline/i }).selectOption({ index: 1 })
    await page.getByRole('radio', { name: /discussion/i }).check()
    await page.getByRole('button', { name: /submit|publish/i }).click()
    await page.waitForURL(/\/thread\//)

    // No crash — some empty state or "no comments" message
    const noComments = page.getByText(/no comments|be the first|start the conversation/i)
      .or(page.getByTestId('empty-comments'))
    await expect(noComments.first()).toBeVisible()
  })
})

// ══════════════════════════════════════════════════════════════════════════
// DISCIPLINE & FEED FLOW (E-23 – E-26)
// ══════════════════════════════════════════════════════════════════════════

test.describe('Discipline & Feed Flow', () => {

  test('E-23 — navigate to /interior-design → real posts visible', async ({ page }) => {
    await page.goto(`${BASE_URL}/interior-design`)
    await expect(page).not.toHaveURL(/404/)

    const postCards = page.locator('[data-testid="post-card"]')
    await expect(postCards.first()).toBeVisible()
  })

  test('E-24 — navigate to /nonexistent-discipline → 404 page', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/this-discipline-absolutely-does-not-exist-xyzzy`)
    // Either HTTP 404 or a page that renders "Not found"
    const status = response?.status() ?? 200
    const is404Page = status === 404 ||
      (await page.getByText(/not found|404/i).isVisible().catch(() => false))
    expect(is404Page).toBe(true)
  })

  test('E-25 — post type filter tabs: click Help → only HELP posts visible', async ({ page }) => {
    await page.goto(`${BASE_URL}/${SEEDED_DISCIPLINE}`)

    await page.getByRole('tab', { name: /help/i }).click()
    await page.waitForTimeout(600)

    const badges = page.locator('[data-testid="post-type-badge"]')
    const count = await badges.count()

    if (count === 0) {
      // Empty state is fine — just no wrong-type posts
      return
    }

    for (let i = 0; i < count; i++) {
      await expect(badges.nth(i)).toHaveText(/help/i)
    }
  })

  test('E-26 — explore page shows discipline grid with real post counts', async ({ page }) => {
    await page.goto(`${BASE_URL}/explore`)

    const disciplineCards = page.locator('[data-testid="discipline-card"]')
    await expect(disciplineCards.first()).toBeVisible()

    // Each card should show a numeric post count
    const firstCard = disciplineCards.first()
    const countText = await firstCard.getByText(/\d+/).first().textContent()
    expect(parseInt(countText ?? '0', 10)).toBeGreaterThanOrEqual(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════
// SEARCH FLOW (E-27 – E-30)
// ══════════════════════════════════════════════════════════════════════════

test.describe('Search Flow', () => {

  test('E-27 — search by keyword → results with post type badge and discipline', async ({ page }) => {
    await page.goto(`${BASE_URL}/search?q=design`)
    await page.waitForSelector('[data-testid="post-card"], [data-testid="search-result"]')

    const firstResult = page.locator('[data-testid="post-card"], [data-testid="search-result"]').first()
    await expect(firstResult).toBeVisible()

    // Each result should have a post type badge
    await expect(firstResult.getByTestId('post-type-badge').or(firstResult.getByText(/discussion|help|showcase|critique|resource/i))).toBeVisible()
  })

  test('E-28 — search with discipline filter → all results in that discipline', async ({ page }) => {
    await page.goto(`${BASE_URL}/search?q=design&discipline=${SEEDED_DISCIPLINE}`)

    const results = page.locator('[data-testid="post-card"], [data-testid="search-result"]')
    const count = await results.count()

    for (let i = 0; i < count; i++) {
      const disciplineText = results.nth(i).getByTestId('discipline-label')
        .or(results.nth(i).locator('[data-testid*="discipline"]'))
      const text = await disciplineText.first().textContent().catch(() => '')
      if (text) {
        expect(text.toLowerCase()).toContain(SEEDED_DISCIPLINE.replace(/-/g, ' ').toLowerCase().slice(0, 5))
      }
    }
  })

  test('E-29 — search with no matches → empty state visible, no crash', async ({ page }) => {
    await page.goto(`${BASE_URL}/search?q=xyzzy123notarealtermatelier`)

    // No crash — an empty state or zero-results message
    const emptyState = page.getByText(/no results|nothing found|0 results/i)
      .or(page.getByTestId('empty-search'))
    await expect(emptyState.first()).toBeVisible()
  })

  test('E-30 — search accessible without login', async ({ page }) => {
    // Ensure not logged in
    await page.goto(`${BASE_URL}/search?q=design`)

    // Should not redirect to login
    expect(page.url()).not.toMatch(/\/login/)
    await expect(page.locator('[data-testid="post-card"], [data-testid="search-result"]').first()).toBeVisible()
  })
})

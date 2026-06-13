/**
 * ATELIER — Section 15: Security Tests
 * Tool: Playwright
 * File: tests/e2e/security/security.spec.ts
 *
 * NOTE: SEC-01 through SEC-11 were coded previously.
 * This file covers SEC-12 through SEC-18.
 *
 * Run: npx playwright test tests/e2e/security/security.spec.ts
 */

import { test, expect, type APIRequestContext } from '@playwright/test'

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Cookie string for a seeded "User A" (post/comment owner) */
const USER_A_COOKIE = process.env.TEST_USER_A_COOKIE ?? ''
/** Cookie string for a seeded "User B" (different user) */
const USER_B_COOKIE = process.env.TEST_USER_B_COOKIE ?? ''

/** Known seeded IDs – set via env or test fixtures */
const SEEDED_POST_SLUG   = process.env.TEST_POST_SLUG    ?? 'test-seeded-post'
const SEEDED_POST_ID     = process.env.TEST_POST_ID      ?? 'seeded-post-id'
const SEEDED_COMMENT_ID  = process.env.TEST_COMMENT_ID   ?? 'seeded-comment-id'
const SEEDED_USER_A_ID   = process.env.TEST_USER_A_ID    ?? 'user-a-id'
const SEEDED_USER_B_ID   = process.env.TEST_USER_B_ID    ?? 'user-b-id'

/** Send an API request with an auth cookie */
async function apiWithCookie(
  request: APIRequestContext,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  cookie: string,
  body?: Record<string, unknown>,
) {
  return request.fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    data: body ? JSON.stringify(body) : undefined,
  })
}

// ─── SEC-12 — Author votes on own comment → 403 ────────────────────────────

test('SEC-12 — author votes on own comment → 403', async ({ request }) => {
  const res = await apiWithCookie(request, 'POST', '/api/votes', USER_A_COOKIE, {
    targetId: SEEDED_COMMENT_ID,
    targetType: 'COMMENT',
    direction: 'UP',
  })

  expect(res.status()).toBe(403)
  const json = await res.json()
  expect(json).toHaveProperty('error')
})

// ─── SEC-13 — XSS: script tag in post body stored escaped ──────────────────

test('SEC-13 — XSS: <script> in post body is escaped, not executed', async ({ page }) => {
  // Authenticate as User A
  await page.context().addCookies([
    { name: 'sb-access-token', value: USER_A_COOKIE, domain: 'localhost', path: '/' },
  ])

  await page.goto('/create')

  // Fill form with XSS payload
  await page.getByLabel(/title/i).fill('XSS Test Post SEC-13')
  await page.getByLabel(/content/i).fill('<script>window.__xss_executed = true</script>Hello World')

  // Pick discipline and post type
  await page.getByRole('combobox', { name: /discipline/i }).selectOption({ index: 1 })
  await page.getByRole('radio', { name: /discussion/i }).check()

  await page.getByRole('button', { name: /submit|publish|post/i }).click()

  // Wait for redirect to thread page
  await page.waitForURL(/\/thread\//)

  // Verify the script was NOT executed
  const xssExecuted = await page.evaluate(() => (window as unknown as Record<string, unknown>).__xss_executed)
  expect(xssExecuted).toBeUndefined()

  // Verify the tag is visible as text, not as a live element
  const scriptTagsInDom = await page.locator('script').count()
  // Only pre-existing Next.js scripts; no injected ones from content
  const content = await page.locator('[data-testid="post-content"]').textContent()
  // The raw text should be present in escaped form, or stripped
  expect(content).not.toContain('<script>')
})

// ─── SEC-14 — SQL injection in search query → empty results, no error ──────

test('SEC-14 — SQL injection in search query returns empty results, no server error', async ({ request }) => {
  const maliciousQuery = encodeURIComponent("'; DROP TABLE posts;--")

  const res = await request.get(`/api/search?q=${maliciousQuery}`)

  // Must return 200 — not 500 or any DB crash
  expect(res.status()).toBe(200)

  const json = await res.json()
  // Result is either empty data array or a data key with empty array
  const data = json.data ?? json
  expect(Array.isArray(data) ? data.length : 0).toBe(0)
})

// ─── SEC-15 — javascript: URI in profile bio → plain text or stripped ──────

test('SEC-15 — javascript: URI in profile bio rendered as plain text', async ({ page, request }) => {
  // Patch profile bio with javascript: payload via API
  const res = await apiWithCookie(
    request,
    'PATCH',
    '/api/profiles/me',
    USER_A_COOKIE,
    { bio: 'Click <a href="javascript:alert(1)">here</a>' },
  )

  // Accept 200 (saved) or 400 (rejected by server validation)
  expect([200, 400]).toContain(res.status())

  if (res.status() === 200) {
    // Navigate to public profile and verify no live javascript: link
    await page.goto(`/profile/${SEEDED_USER_A_ID}`)
    const links = page.locator('a[href^="javascript:"]')
    await expect(links).toHaveCount(0)
  }
})

// ─── SEC-16 — Rate limit: 11 rapid POSTs to /api/posts → 429 on 11th ──────

test('SEC-16 — rate limit: 11th POST /api/posts returns 429', async ({ request }) => {
  const responses: number[] = []

  for (let i = 0; i < 11; i++) {
    const res = await apiWithCookie(request, 'POST', '/api/posts', USER_A_COOKIE, {
      title: `Rate limit test post ${i}`,
      content: 'Rate limit test content',
      disciplineId: 'test-discipline-id',
      postType: 'DISCUSSION',
    })
    responses.push(res.status())
  }

  // First 10 may be 201 or 200 (or 400 for duplicates), but at least one should be 429
  const has429 = responses.includes(429)
  expect(has429).toBe(true)

  // The 11th specifically should be 429
  expect(responses[10]).toBe(429)
})

// ─── SEC-17 — Rate limit: 11 rapid POSTs to /api/votes → 429 on 11th ──────

test('SEC-17 — rate limit: 11th POST /api/votes returns 429', async ({ request }) => {
  const responses: number[] = []

  // Use different fake post IDs to avoid unique-constraint collisions;
  // the rate limiter fires before the DB hit, so invalid IDs still trigger 429
  for (let i = 0; i < 11; i++) {
    const res = await apiWithCookie(request, 'POST', '/api/votes', USER_B_COOKIE, {
      targetId: `fake-post-id-${i}`,
      targetType: 'POST',
      direction: 'UP',
    })
    responses.push(res.status())
  }

  const has429 = responses.includes(429)
  expect(has429).toBe(true)
  expect(responses[10]).toBe(429)
})

// ─── SEC-18 — Rate limit window expires → requests allowed again ────────────

test('SEC-18 — after rate limit window expires, request is allowed (200)', async ({ request }) => {
  const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10)

  // Hit the rate limit first (send 11 requests)
  for (let i = 0; i < 11; i++) {
    await apiWithCookie(request, 'POST', '/api/votes', USER_B_COOKIE, {
      targetId: `expire-test-post-${i}`,
      targetType: 'POST',
      direction: 'UP',
    })
  }

  // Confirm we are rate-limited
  const limited = await apiWithCookie(request, 'POST', '/api/votes', USER_B_COOKIE, {
    targetId: 'expire-check-post',
    targetType: 'POST',
    direction: 'UP',
  })
  expect(limited.status()).toBe(429)

  // Wait for the window to expire
  // In CI, set RATE_LIMIT_WINDOW_MS to a short value (e.g. 5000) for speed
  await new Promise((r) => setTimeout(r, WINDOW_MS + 500))

  // After window, a new request should succeed (200 or 201 or 404 — not 429)
  const after = await apiWithCookie(request, 'POST', '/api/votes', USER_B_COOKIE, {
    targetId: SEEDED_POST_ID,
    targetType: 'POST',
    direction: 'UP',
  })
  expect(after.status()).not.toBe(429)
})

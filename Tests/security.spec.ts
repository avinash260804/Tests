// =============================================================================
// ATELIER — Section 15: Security Tests (SEC-01 to SEC-18)
// File: tests/e2e/security/security.spec.ts
// Tool: Playwright
// =============================================================================

import { test, expect, request } from '@playwright/test'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'

// =============================================================================
// AUTHENTICATION GUARDS (SEC-01 to SEC-07)
// =============================================================================
test.describe('Authentication Guards', () => {
  test('SEC-01: /dashboard without session → redirect to / or /login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/(login|$|auth)/)
  })

  test('SEC-02: /profile/me/edit without session → redirect to login', async ({ page }) => {
    await page.goto('/profile/me/edit')
    await expect(page).toHaveURL(/\/(login|$|auth)/)
  })

  test('SEC-03: POST /api/posts without auth cookie → 401', async () => {
    const ctx = await request.newContext({ baseURL: BASE })
    const res = await ctx.post('/api/posts', {
      data: { title: 'Unauthorized Post', content: 'x', postType: 'DISCUSSION', disciplineId: 'd-1' },
    })
    expect(res.status()).toBe(401)
  })

  test('SEC-04: POST /api/comments without auth → 401', async () => {
    const ctx = await request.newContext({ baseURL: BASE })
    const res = await ctx.post('/api/comments', {
      data: { postSlug: 'some-post', content: 'Hi' },
    })
    expect(res.status()).toBe(401)
  })

  test('SEC-05: POST /api/votes without auth → 401', async () => {
    const ctx = await request.newContext({ baseURL: BASE })
    const res = await ctx.post('/api/votes', {
      data: { postId: 'p1', direction: 'UP', targetType: 'POST' },
    })
    expect(res.status()).toBe(401)
  })

  test('SEC-06: PATCH /api/profiles/me without auth → 401', async () => {
    const ctx = await request.newContext({ baseURL: BASE })
    const res = await ctx.patch('/api/profiles/me', { data: { bio: 'Hacked' } })
    expect(res.status()).toBe(401)
  })

  test('SEC-07: POST /api/help/solution without auth → 401', async () => {
    const ctx = await request.newContext({ baseURL: BASE })
    const res = await ctx.post('/api/help/solution', { data: { postId: 'p1', commentId: 'c1' } })
    expect(res.status()).toBe(401)
  })
})

// =============================================================================
// AUTHORIZATION — OWNERSHIP (SEC-08 to SEC-12)
// Login as User A and try to act on User B's resources
// Requires seeded users: set TEST_USER_A_TOKEN and TEST_USER_B_TOKEN in env
// =============================================================================
test.describe('Authorization (Ownership)', () => {
  let userAHeaders: Record<string, string>

  test.beforeAll(async () => {
    // Assumes a test login endpoint or pre-baked session cookie for User A
    const tokenA = process.env.TEST_USER_A_TOKEN ?? 'mock-token-a'
    userAHeaders = { Cookie: `sb-access-token=${tokenA}` }
  })

  test('SEC-08: User A cannot update User B profile → 403', async () => {
    const ctx = await request.newContext({ baseURL: BASE, extraHTTPHeaders: userAHeaders })
    const userBUsername = process.env.TEST_USER_B_USERNAME ?? 'user-b'
    const res = await ctx.patch(`/api/profiles/${userBUsername}`, { data: { bio: 'Hacked by A' } })
    expect(res.status()).toBe(403)
  })

  test('SEC-09: User A cannot delete User B post → 403', async () => {
    const ctx = await request.newContext({ baseURL: BASE, extraHTTPHeaders: userAHeaders })
    const userBPostId = process.env.TEST_USER_B_POST_ID ?? 'post-owned-by-b'
    const res = await ctx.delete(`/api/posts/${userBPostId}`)
    expect(res.status()).toBe(403)
  })

  test('SEC-10: User A cannot mark User B post as solved → 403', async () => {
    const ctx = await request.newContext({ baseURL: BASE, extraHTTPHeaders: userAHeaders })
    const userBPostId = process.env.TEST_USER_B_POST_ID ?? 'post-owned-by-b'
    const res = await ctx.post('/api/help/solution', {
      data: { postId: userBPostId, commentId: 'some-comment' },
    })
    expect(res.status()).toBe(403)
  })

  test('SEC-11: Author cannot vote on own post → 403', async () => {
    const ctx = await request.newContext({ baseURL: BASE, extraHTTPHeaders: userAHeaders })
    const ownPostId = process.env.TEST_USER_A_POST_ID ?? 'post-owned-by-a'
    const res = await ctx.post('/api/votes', {
      data: { postId: ownPostId, direction: 'UP', targetType: 'POST' },
    })
    expect(res.status()).toBe(403)
  })

  test('SEC-12: Author cannot vote on own comment → 403', async () => {
    const ctx = await request.newContext({ baseURL: BASE, extraHTTPHeaders: userAHeaders })
    const ownCommentId = process.env.TEST_USER_A_COMMENT_ID ?? 'comment-owned-by-a'
    const res = await ctx.post('/api/votes', {
      data: { commentId: ownCommentId, direction: 'UP', targetType: 'COMMENT' },
    })
    expect(res.status()).toBe(403)
  })
})

// =============================================================================
// INJECTION & XSS (SEC-13 to SEC-15)
// =============================================================================
test.describe('Injection & XSS', () => {
  test('SEC-13: <script> in post body → stored as escaped text, not executed', async ({ page }) => {
    // Navigate to a thread where we know a post with script was created
    // In CI: use a seeded post with XSS payload
    await page.goto('/thread/xss-test-post')
    const scriptExecuted = await page.evaluate(() => (window as any).__xss_executed === true)
    expect(scriptExecuted).toBe(false)

    // Also verify no <script> tag appears in the actual DOM content
    const rawScript = await page.$('article script')
    expect(rawScript).toBeNull()
  })

  test('SEC-14: SQL injection search query → returns empty, no DB error', async () => {
    const ctx = await request.newContext({ baseURL: BASE })
    const sqlPayload = encodeURIComponent("'; DROP TABLE posts;--")
    const res = await ctx.get(`/api/search?q=${sqlPayload}`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.data)).toBe(true)
  })

  test('SEC-15: javascript: URI in profile bio → rendered as plain text or stripped', async ({ page }) => {
    await page.goto('/profile/xss-bio-test-user')
    const links = await page.$$('a[href^="javascript:"]')
    expect(links.length).toBe(0)
  })
})

// =============================================================================
// RATE LIMITING (SEC-16 to SEC-18)
// =============================================================================
test.describe('Rate Limiting', () => {
  const AUTH_HEADER = { Cookie: `sb-access-token=${process.env.TEST_RATE_LIMIT_TOKEN ?? 'rate-limit-test-token'}` }

  test('SEC-16: 11 rapid POSTs to /api/posts → 429 on 11th', async () => {
    const ctx = await request.newContext({ baseURL: BASE, extraHTTPHeaders: AUTH_HEADER })
    let lastStatus = 200

    for (let i = 0; i < 11; i++) {
      const res = await ctx.post('/api/posts', {
        data: { title: `Rate Test ${i}`, content: 'x', postType: 'DISCUSSION', disciplineId: 'd-1' },
      })
      lastStatus = res.status()
    }

    expect(lastStatus).toBe(429)
  })

  test('SEC-17: 11 rapid POSTs to /api/votes → 429 on 11th', async () => {
    const ctx = await request.newContext({ baseURL: BASE, extraHTTPHeaders: AUTH_HEADER })
    let lastStatus = 200

    for (let i = 0; i < 11; i++) {
      const res = await ctx.post('/api/votes', {
        data: { postId: `post-${i}`, direction: 'UP', targetType: 'POST' },
      })
      lastStatus = res.status()
    }

    expect(lastStatus).toBe(429)
  })

  test('SEC-18: after rate limit window expires → requests allowed again', async () => {
    // This test is slow (waits for window). Run in isolation or increase timeout.
    test.setTimeout(90_000)

    const ctx = await request.newContext({ baseURL: BASE, extraHTTPHeaders: AUTH_HEADER })

    // Exhaust the limit
    for (let i = 0; i < 11; i++) {
      await ctx.post('/api/votes', {
        data: { postId: `post-expire-${i}`, direction: 'UP', targetType: 'POST' },
      })
    }

    // Wait for the rate limit window to reset (typically 60s)
    const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10)
    await new Promise(r => setTimeout(r, windowMs + 1000))

    const res = await ctx.post('/api/votes', {
      data: { postId: 'post-after-reset', direction: 'UP', targetType: 'POST' },
    })
    expect(res.status()).toBe(200)
  })
})

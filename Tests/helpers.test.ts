// =============================================================================
// ATELIER — Section 3: Unit Tests — Helper Functions (U-01 to U-18)
// File: src/lib/__tests__/helpers.test.ts
// Tool: Vitest
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Adjust these imports to match your actual file paths ──────────────────
import { generateSlug } from '@/lib/slug'
import { getPaginationParams } from '@/lib/pagination'
import { sanitizeHtml } from '@/lib/sanitize'
import { checkRateLimit } from '@/lib/rate-limit'
import { handleError, AppError } from '@/lib/handle-error'
import { requireAuth } from '@/lib/require-auth'

// =============================================================================
// SLUG TESTS (U-01 to U-04)
// =============================================================================
describe('slug.ts', () => {
  it('U-01: converts title with punctuation to lowercase slug', () => {
    expect(generateSlug('My First Post!')).toBe('my-first-post')
  })

  it('U-02: trims whitespace and collapses multiple spaces', () => {
    expect(generateSlug('  Hello   World!! ')).toBe('hello-world')
  })

  it('U-03: strips diacritics (accent characters)', () => {
    expect(generateSlug('Résumé & Design')).toBe('resume-design')
  })

  it('U-04: appends collision suffix on duplicate slug', async () => {
    // Mock or use a pre-loaded slug store
    const first = await generateSlug('my-post', { checkExists: async () => false })
    const second = await generateSlug('my-post', { checkExists: async (slug) => slug === 'my-post' })
    expect(first).toBe('my-post')
    expect(second).toBe('my-post-1')
  })
})

// =============================================================================
// PAGINATION TESTS (U-05 to U-07)
// =============================================================================
describe('pagination.ts', () => {
  it('U-05: page 1, limit 20 → skip 0, take 20', () => {
    expect(getPaginationParams({ page: 1, limit: 20 })).toEqual({ skip: 0, take: 20 })
  })

  it('U-06: page 3, limit 10 → skip 20, take 10', () => {
    expect(getPaginationParams({ page: 3, limit: 10 })).toEqual({ skip: 20, take: 10 })
  })

  it('U-07: page 0 → throws or clamps to page 1 (skip: 0)', () => {
    const result = () => getPaginationParams({ page: 0, limit: 20 })
    // Accept either a throw or a clamp to page 1
    try {
      const val = result()
      expect(val.skip).toBe(0)
    } catch (e) {
      expect(e).toBeTruthy()
    }
  })
})

// =============================================================================
// SANITIZE TESTS (U-08 to U-11)
// =============================================================================
describe('sanitize.ts', () => {
  it('U-08: strips <script> tags', () => {
    const result = sanitizeHtml('Hello <script>alert(1)</script>')
    expect(result).not.toContain('<script>')
    expect(result).not.toContain('alert(1)')
  })

  it('U-09: passes through normal text unchanged', () => {
    expect(sanitizeHtml('Normal text')).toBe('Normal text')
  })

  it('U-10: strips or encodes <img onerror> XSS payload', () => {
    const result = sanitizeHtml('<img src=x onerror=alert(1)>')
    expect(result).not.toContain('onerror')
  })

  it('U-11: strips <b> tags, returns plain text', () => {
    const result = sanitizeHtml('Hello <b>World</b>')
    expect(result).not.toContain('<b>')
    expect(result).toContain('World')
  })
})

// =============================================================================
// RATE LIMIT TESTS (U-12 to U-14)
// =============================================================================
describe('rate-limit.ts', () => {
  const KEY = 'test-user-rate'
  const WINDOW_MS = 1000
  const MAX = 10

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('U-12: 10 calls within window → all allowed', async () => {
    for (let i = 0; i < 10; i++) {
      const result = await checkRateLimit(KEY, { windowMs: WINDOW_MS, max: MAX })
      expect(result.allowed).toBe(true)
    }
  })

  it('U-13: 11th call within window → rate limit exceeded', async () => {
    for (let i = 0; i < 10; i++) {
      await checkRateLimit(KEY + '-11th', { windowMs: WINDOW_MS, max: MAX })
    }
    const result = await checkRateLimit(KEY + '-11th', { windowMs: WINDOW_MS, max: MAX })
    expect(result.allowed).toBe(false)
  })

  it('U-14: after window expires, new call is allowed again', async () => {
    for (let i = 0; i < 10; i++) {
      await checkRateLimit(KEY + '-window', { windowMs: WINDOW_MS, max: MAX })
    }
    // Exhaust the limit
    await checkRateLimit(KEY + '-window', { windowMs: WINDOW_MS, max: MAX })

    // Advance time past the window
    vi.advanceTimersByTime(WINDOW_MS + 100)

    const result = await checkRateLimit(KEY + '-window', { windowMs: WINDOW_MS, max: MAX })
    expect(result.allowed).toBe(true)
  })
})

// =============================================================================
// HANDLE-ERROR + REQUIRE-AUTH TESTS (U-15 to U-18)
// =============================================================================
describe('handle-error.ts', () => {
  it('U-15: AppError(403) → maps to HTTP 403 response', () => {
    const err = new AppError('Forbidden', 403)
    const response = handleError(err)
    expect(response.status).toBe(403)
  })

  it('U-16: unknown Error → maps to HTTP 500 response', () => {
    const err = new Error('Something exploded')
    const response = handleError(err)
    expect(response.status).toBe(500)
  })
})

describe('require-auth.ts', () => {
  it('U-17: valid Supabase session → returns user object', async () => {
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: 'user-abc', email: 'user@example.com' } },
      error: null,
    })
    const supabase = { auth: { getUser: mockGetUser } } as any

    const user = await requireAuth(supabase)
    expect(user).toMatchObject({ id: 'user-abc' })
  })

  it('U-18: missing session → throws AppError(401)', async () => {
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    })
    const supabase = { auth: { getUser: mockGetUser } } as any

    await expect(requireAuth(supabase)).rejects.toThrow()
    try {
      await requireAuth(supabase)
    } catch (e: any) {
      expect(e.status ?? e.statusCode).toBe(401)
    }
  })
})

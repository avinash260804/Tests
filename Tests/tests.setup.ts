/**
 * ATELIER — Vitest Per-File Setup
 * File: tests/setup.ts
 *
 * Runs before EVERY Vitest test file (setupFiles in vitest.config.ts).
 *
 * Responsibilities:
 *   1. Extend expect with @testing-library/jest-dom matchers
 *   2. Start / reset / stop MSW server
 *   3. Reset prismock between tests
 *   4. Suppress noisy console output in tests
 *   5. Set required environment variables for unit tests
 */

import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// ── 1. React Testing Library cleanup ──────────────────────────────────────
// Unmounts components and clears DOM between tests
afterEach(() => {
  cleanup()
})

// ── 2. MSW Server ─────────────────────────────────────────────────────────
// Lazily imported so unit tests that don't need MSW don't pay the startup cost
let server: import('msw/node').SetupServer | undefined

beforeAll(async () => {
  if (process.env.VITEST_MSW !== 'false') {
    const { server: mswServer } = await import('./msw/server')
    server = mswServer
    server.listen({ onUnhandledRequest: 'warn' })
  }
})

afterEach(() => {
  // Reset handlers to defaults after each test (allows per-test overrides)
  server?.resetHandlers()
})

afterAll(() => {
  server?.close()
})

// ── 3. Prismock reset ─────────────────────────────────────────────────────
// Clears all in-memory prismock data between tests so they don't bleed into each other
afterEach(async () => {
  try {
    const { prismock } = await import('./factories/prismock-instance')
    // prismock exposes reset() in v2+
    if (typeof (prismock as unknown as { reset?: () => void }).reset === 'function') {
      ;(prismock as unknown as { reset: () => void }).reset()
    }
  } catch {
    // prismock not used in this test file — safe to ignore
  }
})

// ── 4. Console suppression ────────────────────────────────────────────────
// Suppress expected console.error calls that Next.js / React emit during tests
// (e.g. prop-type warnings, act() warnings). Real unexpected errors still surface.
const SUPPRESSED_PATTERNS = [
  /Warning: ReactDOM.render is no longer supported/,
  /Warning: An update to .* inside a test was not wrapped in act/,
  /Error: Not implemented: navigation/,         // jsdom navigation stub
  /Warning: Each child in a list should have a unique "key"/,
]

const originalConsoleError = console.error
const originalConsoleWarn  = console.warn

beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const msg = String(args[0] ?? '')
    if (SUPPRESSED_PATTERNS.some((p) => p.test(msg))) return
    originalConsoleError(...args)
  }
  console.warn = (...args: unknown[]) => {
    const msg = String(args[0] ?? '')
    if (SUPPRESSED_PATTERNS.some((p) => p.test(msg))) return
    originalConsoleWarn(...args)
  }
})

afterAll(() => {
  console.error = originalConsoleError
  console.warn  = originalConsoleWarn
})

// ── 5. Environment variables for unit tests ───────────────────────────────
// These are the minimum env vars that services/helpers read at import time.
// They are overridden by the real .env.test when running against a real DB.
process.env.NEXT_PUBLIC_SUPABASE_URL      ??= 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY     ??= 'test-service-role-key'
process.env.DATABASE_URL                  ??= 'postgresql://postgres:postgres@localhost:54322/postgres'
process.env.NEXTAUTH_SECRET               ??= 'test-secret-for-vitest-32-chars!!'
process.env.RATE_LIMIT_MAX                ??= '10'
process.env.RATE_LIMIT_WINDOW_MS          ??= '60000'

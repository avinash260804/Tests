// tests/setup.ts — Global Vitest setup for Atelier
import '@testing-library/jest-dom'
import { vi, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Cleanup DOM after every test
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// Suppress Next.js router warnings in component tests
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    pathname: '/',
    query: {},
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: () => new Headers(),
}))

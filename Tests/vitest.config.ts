/**
 * ATELIER — Vitest Configuration
 * File: vitest.config.ts  (root of project)
 *
 * Covers all Vitest test categories:
 *   Section 1  — Static Analysis  (CLI-based, not Vitest)
 *   Section 2  — Schema tests     (CLI-based, not Vitest)
 *   Section 3  — Unit: Helpers    src/lib/__tests__/
 *   Section 4  — Unit: Post Svc   src/modules/posts/__tests__/
 *   Section 5  — Unit: Comment    src/modules/comments/__tests__/
 *   Section 6  — Unit: Help Svc   src/modules/help/__tests__/
 *   Section 7  — Unit: Vote Svc   src/modules/votes/__tests__/
 *   Section 8  — Unit: Other      src/modules/{reputation,feed,search,tags,profiles}/__tests__/
 *   Section 9  — Integration      tests/integration/
 *   Section 10 — API Routes       src/app/api/__tests__/
 *   Section 11 — Components       src/__tests__/components/
 *   Section 12 — Snapshots        tests/snapshots/
 *   Section 13 — Form Validation  tests/forms/
 *   Section 19 — Build & CI       tests/build-ci/  (subset — non-shell tests)
 */

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from 'path'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
    },
  },

  test: {
    globals: true,
    environment: 'jsdom',

    // Global setup runs once before all test files
    globalSetup: ['./tests/setup.global.ts'],

    // Per-file setup runs before each test file
    setupFiles: ['./tests/setup.ts'],

    // Load test env vars
    env: {
      // Vitest reads .env.test automatically via dotenv
    },

    // ── Coverage ───────────────────────────────────────────────────────
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'tests/**',
        '**/*.config.*',
        '**/*.d.ts',
        'prisma/**',
        '.next/**',
        'src/app/layout.tsx',      // Next.js boilerplate
        'src/app/page.tsx',        // thin shell
        'src/middleware.ts',       // auth redirect logic — covered by E2E
      ],
      thresholds: {
        lines: 80,
        functions: 75,
        branches: 70,
        statements: 80,
      },
    },

    // ── Exclude Playwright files from Vitest ───────────────────────────
    exclude: [
      'node_modules/**',
      'tests/e2e/**',
      'tests/visual/**',
      'tests/rls/**',
      '.next/**',
    ],

    // ── Per-project include patterns ────────────────────────────────────
    // Use `vitest run --project=<name>` or the npm scripts defined in package.json

    // ── Timeouts ───────────────────────────────────────────────────────
    testTimeout: 30_000,           // 30s default (integration tests may be slow)
    hookTimeout: 15_000,

    // ── Reporter ───────────────────────────────────────────────────────
    reporters: process.env.CI
      ? ['verbose', 'junit']
      : ['verbose'],

    outputFile: {
      junit: './test-results/vitest-junit.xml',
    },

    // ── Pool ───────────────────────────────────────────────────────────
    pool: 'forks',                 // forks isolate prismock state between files
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },
  },
})

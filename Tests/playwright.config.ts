/**
 * ATELIER — Playwright Configuration
 * File: playwright.config.ts  (root of project)
 *
 * Projects:
 *   setup        — runs auth.setup.ts once to create storageState files
 *   security     — SEC-12 to SEC-18
 *   e2e-flows    — E-01  to E-30
 *   e2e-errors   — EB-01 to EB-12
 *   accessibility — A11Y-01 to A11Y-08
 *   visual       — VR-01  to VR-06
 *   performance  — PERF-01 to PERF-06
 *   smoke        — SMOKE-01 to SMOKE-11
 *
 * Usage:
 *   npx playwright test                        # all projects
 *   npx playwright test --project=e2e-flows    # one project
 *   npx playwright test --update-snapshots     # refresh VR baselines
 */

import { defineConfig, devices } from '@playwright/test'
import path from 'path'
import dotenv from 'dotenv'

// Load test-specific env vars
dotenv.config({ path: path.resolve(__dirname, '.env.test') })

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'

/** Where Playwright stores authenticated session cookies */
export const STORAGE_STATE_USER_A = path.resolve(__dirname, 'tests/.auth/user-a.json')
export const STORAGE_STATE_USER_B = path.resolve(__dirname, 'tests/.auth/user-b.json')

export default defineConfig({
  // ── Global settings ──────────────────────────────────────────────────
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,       // fail fast in CI if test.only is left in
  retries: process.env.CI ? 2 : 0,   // retry flaky tests in CI only
  workers: process.env.CI ? 4 : 2,
  timeout: 60_000,                    // per-test timeout

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },

  // ── Snapshot / visual regression settings ───────────────────────────
  snapshotDir: 'tests/visual/__snapshots__',
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 500,
      threshold: 0.02,
      animations: 'disabled',
    },
  },

  // ── Projects ────────────────────────────────────────────────────────
  projects: [
    // ① Auth setup — must run first, produces storageState files
    {
      name: 'setup',
      testMatch: '**/auth.setup.ts',
      use: { ...devices['Desktop Chrome'] },
    },

    // ② Security (SEC-12 – SEC-18)
    {
      name: 'security',
      testDir: './tests/e2e/security',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE_USER_A,
      },
    },

    // ③ E2E User Flows (E-01 – E-30)
    {
      name: 'e2e-flows',
      testDir: './tests/e2e/flows',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        // Individual tests create their own contexts for multi-user flows
        storageState: STORAGE_STATE_USER_A,
      },
    },

    // ④ E2E Error Boundaries (EB-01 – EB-12)
    {
      name: 'e2e-errors',
      testDir: './tests/e2e/errors',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE_USER_A,
      },
    },

    // ⑤ Accessibility (A11Y-01 – A11Y-08)
    {
      name: 'accessibility',
      testDir: './tests/e2e/accessibility',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE_USER_A,
      },
    },

    // ⑥ Visual Regression (VR-01 – VR-06)
    {
      name: 'visual',
      testDir: './tests/visual',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE_USER_A,
        // Consistent font rendering across machines
        launchOptions: { args: ['--font-render-hinting=none', '--disable-font-subpixel-positioning'] },
      },
    },

    // ⑦ Performance (PERF-01 – PERF-06)
    {
      name: 'performance',
      testDir: './tests/e2e/performance',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE_USER_A,
      },
    },

    // ⑧ Smoke Tests (SMOKE-01 – SMOKE-11)
    {
      name: 'smoke',
      testDir: './tests/e2e/smoke',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE_USER_A,
      },
    },
  ],

  // ── Local dev server (optional — comment out if starting manually) ──
  // webServer: {
  //   command: 'npm run dev',
  //   url: BASE_URL,
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120_000,
  // },
})

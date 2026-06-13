/**
 * ATELIER — Playwright Auth Setup
 * File: tests/e2e/auth.setup.ts
 *
 * Runs ONCE before all Playwright projects (dependency: 'setup' in playwright.config.ts).
 * Logs in as User A and User B via the real UI, then saves browser storage state to disk.
 * All subsequent Playwright tests load that state instead of logging in each time.
 *
 * Output files:
 *   tests/.auth/user-a.json   — User A session (post/comment owner)
 *   tests/.auth/user-b.json   — User B session (second actor for multi-user tests)
 *
 * Re-run if:
 *   - Sessions expire
 *   - Auth flow changes
 *   - You rotate test account passwords
 */

import { test as setup, expect } from '@playwright/test'
import path from 'path'
import fs from 'node:fs'

const BASE_URL     = process.env.BASE_URL          ?? 'http://localhost:3000'
const USER_A_EMAIL = process.env.TEST_USER_A_EMAIL ?? 'usera@atelier.test'
const USER_A_PASS  = process.env.TEST_USER_A_PASS  ?? 'TestPassword1!'
const USER_B_EMAIL = process.env.TEST_USER_B_EMAIL ?? 'userb@atelier.test'
const USER_B_PASS  = process.env.TEST_USER_B_PASS  ?? 'TestPassword2!'

const AUTH_DIR = path.resolve(__dirname, '../.auth')

setup.beforeAll(() => {
  // Ensure the .auth directory exists
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true })
  }
})

// ─── Login helper ──────────────────────────────────────────────────────────

async function loginAndSave(
  email: string,
  password: string,
  storageStatePath: string,
  page: import('@playwright/test').Page,
) {
  await page.goto(`${BASE_URL}/login`)

  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in|log in|login/i }).click()

  // Wait until redirected away from /login — confirms auth succeeded
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 15_000,
  })

  // Confirm we landed on a protected page
  expect(page.url()).not.toContain('/login')

  // Persist cookies + localStorage so subsequent tests skip the login screen
  await page.context().storageState({ path: storageStatePath })

  // Also extract and export the auth cookie string for API-level tests
  const cookies = await page.context().cookies()
  const authCookie = cookies
    .filter((c) => c.name.startsWith('sb-') || c.name === 'next-auth.session-token')
    .map((c) => `${c.name}=${c.value}`)
    .join('; ')

  // Write cookie string to a sidecar .txt for use in request-level tests
  const cookiePath = storageStatePath.replace('.json', '-cookie.txt')
  fs.writeFileSync(cookiePath, authCookie, 'utf-8')

  console.log(`  ✅ Saved session for ${email} → ${path.basename(storageStatePath)}`)
}

// ─── Setup: User A ─────────────────────────────────────────────────────────

setup('authenticate as User A', async ({ page }) => {
  const storageStatePath = path.join(AUTH_DIR, 'user-a.json')
  await loginAndSave(USER_A_EMAIL, USER_A_PASS, storageStatePath, page)
})

// ─── Setup: User B ─────────────────────────────────────────────────────────

setup('authenticate as User B', async ({ page }) => {
  const storageStatePath = path.join(AUTH_DIR, 'user-b.json')
  await loginAndSave(USER_B_EMAIL, USER_B_PASS, storageStatePath, page)
})

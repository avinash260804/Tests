/**
 * ATELIER — Vitest Global Setup
 * File: tests/setup.global.ts
 *
 * Runs ONCE before the entire Vitest suite (globalSetup in vitest.config.ts).
 * Use for one-time setup that is too expensive to repeat per file:
 *   - Verifying the test database is reachable
 *   - Applying migrations to the pgLite test DB
 *   - Seeding baseline fixture data
 *
 * Returns a teardown function that Vitest calls after all tests finish.
 */

import { execSync } from 'node:child_process'

export async function setup() {
  console.log('\n🔧 Vitest global setup starting...')

  // ── Validate required env vars are present ─────────────────────────
  const required = [
    'DATABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]
  const missing = required.filter((k) => !process.env[k])
  if (missing.length > 0) {
    console.warn(
      `⚠️  Missing env vars for integration tests: ${missing.join(', ')}\n` +
      `   Unit/component tests will still work. Copy .env.test.example → .env.test to fix.\n`,
    )
  }

  // ── Integration DB: apply migrations if VITEST_RUN_INTEGRATION=true ─
  if (process.env.VITEST_RUN_INTEGRATION === 'true') {
    console.log('  Applying Prisma migrations to test DB...')
    try {
      execSync('npx prisma migrate deploy', {
        env: { ...process.env },
        stdio: 'pipe',
      })
      console.log('  ✅ Migrations applied')
    } catch (err) {
      console.error('  ❌ Migration failed:', (err as Error).message)
      throw err
    }
  }

  console.log('✅ Vitest global setup complete\n')
}

export async function teardown() {
  console.log('\n🧹 Vitest global teardown...')

  // Clean up any test data written to a real DB during integration tests
  if (process.env.VITEST_RUN_INTEGRATION === 'true') {
    try {
      const { PrismaClient } = await import('@prisma/client')
      const prisma = new PrismaClient({
        datasources: { db: { url: process.env.DATABASE_URL } },
      })
      // Delete test-generated rows (identified by test email domain)
      await prisma.post.deleteMany({ where: { author: { email: { endsWith: '@atelier.test' } } } })
      await prisma.comment.deleteMany({ where: { author: { email: { endsWith: '@atelier.test' } } } })
      await prisma.$disconnect()
      console.log('  ✅ Test data cleaned up')
    } catch {
      console.warn('  ⚠️  Teardown cleanup failed — test DB may need manual reset')
    }
  }

  console.log('✅ Vitest global teardown complete\n')
}

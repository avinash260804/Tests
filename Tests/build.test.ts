/**
 * ATELIER — Section 19: Build & CI Tests (10 tests)
 * Tool: Node.js child_process / shell scripts
 * File: tests/build-ci/build.test.ts
 *
 * Covers B-01 through B-10
 * Run: vitest run tests/build-ci/build.test.ts
 *
 * These tests are designed to run as part of the CI pipeline.
 * They shell out to real CLI tools (Next.js build, Prisma, ripgrep)
 * so they must run in an environment where these binaries are available.
 *
 * Set SKIP_BUILD_TESTS=true to skip slow tests in local watch mode.
 */

import { execSync, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeAll } from 'vitest'

// ─── Helpers ───────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '../../')

/** Run a shell command and return { stdout, stderr, status } */
function run(cmd: string, cwd = ROOT) {
  const result = spawnSync(cmd, {
    shell: true,
    cwd,
    encoding: 'utf-8',
    timeout: 5 * 60 * 1000, // 5 min max
  })
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status ?? 1,
  }
}

/** Skip slow tests when SKIP_BUILD_TESTS=true (e.g. local watch mode) */
const skipSlow = process.env.SKIP_BUILD_TESTS === 'true'
const itSlow = skipSlow ? it.skip : it

// ─── B-01: Production build completes with exit 0 ─────────────────────────

describe('B-01 — Production build', () => {
  itSlow('npm run build completes with exit 0 and zero errors', () => {
    const { status, stderr, stdout } = run('npm run build')

    const combinedOutput = stdout + stderr
    expect(
      status,
      `Build failed (exit ${status}):\n${combinedOutput.slice(0, 2000)}`,
    ).toBe(0)

    // No "Error:" lines in build output
    const errorLines = combinedOutput
      .split('\n')
      .filter((l) => /^\s*Error:/i.test(l) && !l.includes('//'))
    expect(errorLines, `Build output contains error lines:\n${errorLines.join('\n')}`).toHaveLength(0)
  })
})

// ─── B-02: Build has no missing env var warnings ──────────────────────────

describe('B-02 — No missing env var warnings', () => {
  itSlow('build output contains no MISSING_ENV or undefined env warnings', () => {
    const { stdout, stderr } = run('npm run build')
    const combined = stdout + stderr

    const missingEnvLines = combined
      .split('\n')
      .filter((l) => /MISSING_ENV|process\.env\.\w+ is undefined|Environment variable.*not defined/i.test(l))

    expect(
      missingEnvLines,
      `Missing env var warnings found:\n${missingEnvLines.join('\n')}`,
    ).toHaveLength(0)
  })
})

// ─── B-03: npm run verify passes serially ─────────────────────────────────

describe('B-03 — npm run verify (full chain)', () => {
  itSlow('typecheck && lint && test && build all exit 0', () => {
    const { status, stdout, stderr } = run('npm run verify')
    const out = stdout + stderr

    expect(
      status,
      `verify chain failed (exit ${status}):\n${out.slice(0, 3000)}`,
    ).toBe(0)
  })
})

// ─── B-04: No pending migrations ──────────────────────────────────────────

describe('B-04 — No pending Prisma migrations', () => {
  it('prisma migrate status reports database is up to date', () => {
    const { stdout, stderr, status } = run('npx prisma migrate status')
    const combined = stdout + stderr

    // Accept exit 0 OR output containing "up to date"
    const isUpToDate =
      status === 0 ||
      /up to date|no pending migrations/i.test(combined)

    expect(
      isUpToDate,
      `Pending migrations detected:\n${combined.slice(0, 1000)}`,
    ).toBe(true)
  })
})

// ─── B-05: Seed completes without error ───────────────────────────────────

describe('B-05 — Seed runs without error', () => {
  itSlow('npx prisma db seed exits 0', () => {
    const { status, stdout, stderr } = run('npx prisma db seed')
    const combined = stdout + stderr

    expect(
      status,
      `Seed failed (exit ${status}):\n${combined.slice(0, 1000)}`,
    ).toBe(0)
  })
})

// ─── B-06: Seed is idempotent — run twice, no duplicates ──────────────────

describe('B-06 — Seed is idempotent', () => {
  itSlow('running seed twice produces identical row counts', async () => {
    // Run seed twice and compare key table counts via prisma.$queryRaw
    const countScript = `
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      async function main() {
        const posts = await prisma.post.count();
        const profiles = await prisma.profile.count();
        const disciplines = await prisma.discipline.count();
        console.log(JSON.stringify({ posts, profiles, disciplines }));
        await prisma.$disconnect();
      }
      main().catch(console.error);
    `

    run('npx prisma db seed')
    const { stdout: after1 } = run(`node -e "${countScript.replace(/\n/g, ' ')}"`)

    run('npx prisma db seed')
    const { stdout: after2 } = run(`node -e "${countScript.replace(/\n/g, ' ')}"`)

    const counts1 = JSON.parse(after1.trim().split('\n').pop() ?? '{}')
    const counts2 = JSON.parse(after2.trim().split('\n').pop() ?? '{}')

    expect(counts1.posts, 'Post count changed after second seed').toBe(counts2.posts)
    expect(counts1.profiles, 'Profile count changed after second seed').toBe(counts2.profiles)
    expect(counts1.disciplines, 'Discipline count changed after second seed').toBe(counts2.disciplines)
  })
})

// ─── B-07: node --check on seed file passes ───────────────────────────────

describe('B-07 — Seed file syntax check', () => {
  it('node --check prisma/seed.ts (or seed.js) exits 0', () => {
    // Support both .ts (ts-node) and .js
    const seedTs = path.join(ROOT, 'prisma/seed.ts')
    const seedJs = path.join(ROOT, 'prisma/seed.js')

    if (existsSync(seedTs)) {
      const { status, stderr } = run(`npx ts-node --noEmit prisma/seed.ts`)
      expect(status, `Seed .ts syntax error:\n${stderr}`).toBe(0)
    } else if (existsSync(seedJs)) {
      const { status, stderr } = run(`node --check prisma/seed.js`)
      expect(status, `Seed .js syntax error:\n${stderr}`).toBe(0)
    } else {
      throw new Error('Could not find prisma/seed.ts or prisma/seed.js')
    }
  })
})

// ─── B-08: Bundle size — no unexpected chunks > 500KB ─────────────────────

describe('B-08 — Bundle chunk size', () => {
  itSlow('no individual JS chunk in .next/static/chunks exceeds 500KB unexplained', () => {
    const chunksDir = path.join(ROOT, '.next/static/chunks')
    if (!existsSync(chunksDir)) {
      throw new Error('.next/static/chunks not found — run npm run build first')
    }

    const MAX_BYTES = 500 * 1024 // 500KB

    // Known-large allowed chunks (e.g. framework, main)
    const ALLOWED_LARGE = [
      'framework',
      'main',
      'polyfills',
      'webpack',
    ]

    function scanDir(dir: string): string[] {
      const oversized: string[] = []
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          oversized.push(...scanDir(fullPath))
        } else if (entry.name.endsWith('.js')) {
          const size = statSync(fullPath).size
          const isAllowed = ALLOWED_LARGE.some((prefix) => entry.name.startsWith(prefix))
          if (size > MAX_BYTES && !isAllowed) {
            oversized.push(`${fullPath} (${(size / 1024).toFixed(1)} KB)`)
          }
        }
      }
      return oversized
    }

    const oversized = scanDir(chunksDir)
    expect(
      oversized,
      `Unexpectedly large chunks found (> 500KB):\n${oversized.join('\n')}\nSplit these or add to ALLOWED_LARGE.`,
    ).toHaveLength(0)
  })
})

// ─── B-09: No routes with dynamic="auto" on DB read paths ─────────────────

describe('B-09 — No implicit dynamic="auto" on DB read API routes', () => {
  it('all API routes declare explicit dynamic or force-dynamic', () => {
    const { stdout } = run(
      `rg "dynamic" src/app/api/ --include="*.ts" --include="*.tsx" -l 2>/dev/null || true`,
    )

    const filesWithDynamic = stdout.trim().split('\n').filter(Boolean)

    // For each file that mentions "dynamic", read it and check for auto
    const violators: string[] = []

    for (const filePath of filesWithDynamic) {
      const absPath = path.join(ROOT, filePath)
      if (!existsSync(absPath)) continue

      const content = readFileSync(absPath, 'utf-8')

      // Flag if it uses dynamic = "auto" (the default — must be explicit)
      if (/export\s+const\s+dynamic\s*=\s*['"]auto['"]/m.test(content)) {
        violators.push(filePath)
      }

      // Also flag if there's a DB call (prisma) but NO dynamic export at all
      if (
        content.includes('prisma.') &&
        !/export\s+const\s+dynamic/m.test(content)
      ) {
        violators.push(`${filePath} (missing explicit dynamic export)`)
      }
    }

    // Also scan files that have prisma but didn't appear in the rg above
    const { stdout: prismaFiles } = run(
      `rg "prisma\\." src/app/api/ --include="*.ts" --include="*.tsx" -l 2>/dev/null || true`,
    )
    for (const filePath of prismaFiles.trim().split('\n').filter(Boolean)) {
      const absPath = path.join(ROOT, filePath)
      if (!existsSync(absPath)) continue
      const content = readFileSync(absPath, 'utf-8')
      if (!/export\s+const\s+dynamic/m.test(content) && !violators.includes(filePath)) {
        violators.push(`${filePath} (DB read route missing dynamic export)`)
      }
    }

    const uniqueViolators = [...new Set(violators)]
    expect(
      uniqueViolators,
      `Routes with implicit dynamic="auto" on DB paths:\n${uniqueViolators.join('\n')}`,
    ).toHaveLength(0)
  })
})

// ─── B-10: TypeScript strict mode — no implicit any ──────────────────────

describe('B-10 — TypeScript strict mode passes', () => {
  it('tsc --strict --noEmit exits 0 with no implicit any errors', () => {
    const { status, stdout, stderr } = run('npx tsc --strict --noEmit')
    const combined = stdout + stderr

    expect(
      status,
      `TypeScript strict check failed:\n${combined.slice(0, 3000)}`,
    ).toBe(0)
  })
})

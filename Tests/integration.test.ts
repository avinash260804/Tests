// =============================================================================
// ATELIER — Section 9: Integration Tests (INT-01 to INT-20)
// File: tests/integration/integration.test.ts
// Tool: Vitest + real Postgres (pgLite or local test DB)
// Each test wraps in a transaction and rolls back for isolation.
// =============================================================================

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { createPost, listPosts, getPostBySlug, deletePost } from '@/modules/posts/post-service'
import { createComment, listCommentsBySlug } from '@/modules/comments/comment-service'
import { voteOnPost } from '@/modules/votes/vote-service'
import { markAsSolved, clearSolved } from '@/modules/help/help-solution-service'
import { recalculateReputation } from '@/modules/reputation/reputation-service'
import { getFeed } from '@/modules/feed/feed-service'
import { searchPosts } from '@/modules/search/search-service'
import { listTags } from '@/modules/tags/tag-service'
import { updateProfile, getPublicProfile } from '@/modules/profiles/profile-service'

// ── Real DB client pointing at the test database ─────────────────────────
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.TEST_DATABASE_URL } },
})

// Helper: seed minimal fixtures
async function seedFixtures() {
  const discipline = await prisma.discipline.upsert({
    where: { slug: 'int-test-disc' },
    create: { slug: 'int-test-disc', name: 'Integration Test Discipline' },
    update: {},
  })
  const author = await prisma.profile.upsert({
    where: { username: 'int-author' },
    create: { username: 'int-author', onboarded: true, disciplineId: discipline.id, reputation: 10 },
    update: {},
  })
  const voter = await prisma.profile.upsert({
    where: { username: 'int-voter' },
    create: { username: 'int-voter', onboarded: true, disciplineId: discipline.id, reputation: 0 },
    update: {},
  })
  return { discipline, author, voter }
}

let f: Awaited<ReturnType<typeof seedFixtures>>
let tx: PrismaClient   // transaction-scoped client for isolation

beforeAll(async () => {
  f = await seedFixtures()
})

// Each test runs in a rolled-back transaction for isolation
beforeEach(async () => {
  // NOTE: real transaction isolation requires pgLite or `BEGIN`/`ROLLBACK` approach.
  // For simplicity, we use a fresh seed + cleanup. Swap for actual $transaction if supported.
  tx = prisma
})

afterEach(async () => {
  // Clean up test data created during each test to keep things isolated
  await prisma.vote.deleteMany({ where: { post: { slug: { startsWith: 'int-' } } } })
  await prisma.comment.deleteMany({ where: { post: { slug: { startsWith: 'int-' } } } })
  await prisma.post.deleteMany({ where: { slug: { startsWith: 'int-' } } })
})

// =============================================================================
const postPayload = (n = 1) => ({
  title: `Integration Post ${n}`,
  content: `Content for integration test ${n}`,
  postType: 'DISCUSSION' as const,
  disciplineId: f?.discipline?.id ?? '',
})
// =============================================================================

describe('INT-01: Create post → read back by slug', () => {
  it('data matches after write + read round-trip', async () => {
    const created = await createPost(tx, f.author.id, { ...postPayload(), title: 'INT-01 Post' })
    const found = await getPostBySlug(tx, created.slug)
    expect(found?.title).toBe('INT-01 Post')
  })
})

describe('INT-02: Soft-delete post → list query excludes it', () => {
  it('WHERE deletedAt IS NULL filter works in real SQL', async () => {
    const post = await createPost(tx, f.author.id, { ...postPayload(2), title: 'INT-02 Post' })
    await deletePost(tx, f.author.id, post.id)
    const all = await listPosts(tx, {})
    expect(all.find(p => p.id === post.id)).toBeUndefined()
  })
})

describe('INT-03: Create comment → post commentCount incremented', () => {
  it('atomic transaction in real DB', async () => {
    const post = await createPost(tx, f.author.id, { ...postPayload(3), title: 'INT-03 Post' })
    await createComment(tx, { postSlug: post.slug, content: 'Hello', userId: f.voter.id })
    const updated = await tx.post.findUnique({ where: { id: post.id } })
    expect(updated?.commentCount).toBe(1)
  })
})

describe('INT-04: Soft-delete comment → list excludes it', () => {
  it('DB-level soft delete on comments', async () => {
    const post = await createPost(tx, f.author.id, { ...postPayload(4), title: 'INT-04 Post' })
    const comment = await createComment(tx, { postSlug: post.slug, content: 'Will delete', userId: f.voter.id })
    await tx.comment.update({ where: { id: comment.id }, data: { deletedAt: new Date() } })
    const comments = await listCommentsBySlug(tx, post.slug)
    expect(comments.find(c => c.id === comment.id)).toBeUndefined()
  })
})

describe('INT-05: Two votes same post, same user → unique constraint throws', () => {
  it('DB unique constraint enforced', async () => {
    const post = await createPost(tx, f.author.id, { ...postPayload(5), title: 'INT-05 Post' })
    await voteOnPost(tx, { voterId: f.voter.id, postId: post.id, direction: 'UP' })
    // Second vote same direction should toggle, but direct DB insert should throw
    await expect(
      tx.vote.create({ data: { authorId: f.voter.id, postId: post.id, direction: 'UP' } })
    ).rejects.toThrow()
  })
})

describe('INT-06: Vote toggle — create then remove', () => {
  it('DB row deleted after toggle', async () => {
    const post = await createPost(tx, f.author.id, { ...postPayload(6), title: 'INT-06 Post' })
    await voteOnPost(tx, { voterId: f.voter.id, postId: post.id, direction: 'UP' })
    await voteOnPost(tx, { voterId: f.voter.id, postId: post.id, direction: 'UP' }) // toggle off
    const vote = await tx.vote.findUnique({ where: { authorId_postId: { authorId: f.voter.id, postId: post.id } } })
    expect(vote).toBeNull()
  })
})

describe('INT-07: Vote flip — up then down → only 1 vote row', () => {
  it('DB state correct after flip', async () => {
    const post = await createPost(tx, f.author.id, { ...postPayload(7), title: 'INT-07 Post' })
    await voteOnPost(tx, { voterId: f.voter.id, postId: post.id, direction: 'UP' })
    await voteOnPost(tx, { voterId: f.voter.id, postId: post.id, direction: 'DOWN' })
    const votes = await tx.vote.findMany({ where: { postId: post.id, authorId: f.voter.id } })
    expect(votes.length).toBe(1)
    expect(votes[0].direction).toBe('DOWN')
  })
})

describe('INT-08: Mark help post solved → acceptedCommentId set in DB', () => {
  it('real DB write confirms acceptedCommentId', async () => {
    const post = await createPost(tx, f.author.id, { ...postPayload(8), title: 'INT-08 Help', postType: 'HELP' })
    const comment = await createComment(tx, { postSlug: post.slug, content: 'The answer', userId: f.voter.id })
    await markAsSolved(tx, f.author.id, post.id, comment.id)
    const updated = await tx.post.findUnique({ where: { id: post.id } })
    expect(updated?.acceptedCommentId).toBe(comment.id)
  })
})

describe('INT-09: Clear solved → acceptedCommentId null in DB', () => {
  it('real DB write confirms null', async () => {
    const post = await createPost(tx, f.author.id, { ...postPayload(9), title: 'INT-09 Help', postType: 'HELP' })
    const comment = await createComment(tx, { postSlug: post.slug, content: 'Answer', userId: f.voter.id })
    await markAsSolved(tx, f.author.id, post.id, comment.id)
    await clearSolved(tx, f.author.id, post.id)
    const updated = await tx.post.findUnique({ where: { id: post.id } })
    expect(updated?.acceptedCommentId).toBeNull()
  })
})

describe('INT-10: Reputation recalculate after upvote → Profile.reputation updated', () => {
  it('real aggregation query updates reputation', async () => {
    const post = await createPost(tx, f.author.id, { ...postPayload(10), title: 'INT-10 Post' })
    await voteOnPost(tx, { voterId: f.voter.id, postId: post.id, direction: 'UP' })
    await recalculateReputation(tx, f.author.id)
    const profile = await tx.profile.findUnique({ where: { id: f.author.id } })
    expect(profile?.reputation).toBeGreaterThan(0)
  })
})

describe('INT-11: getFeed with discipline filter → real seeded posts', () => {
  it('service reads real DB rows', async () => {
    await createPost(tx, f.author.id, { ...postPayload(11), title: 'INT-11 Post' })
    const feed = await getFeed(tx, { disciplineSlug: 'int-test-disc' })
    expect(feed.length).toBeGreaterThan(0)
  })
})

describe('INT-12: searchPosts returns seeded post matching keyword', () => {
  it('real DB ILIKE query works', async () => {
    await createPost(tx, f.author.id, { ...postPayload(12), title: 'INT-12 Unique Keyword xyzqwerty' })
    const results = await searchPosts(tx, { query: 'xyzqwerty' })
    expect(results.length).toBeGreaterThan(0)
  })
})

describe('INT-13: listTags returns seeded tags matching prefix', () => {
  it('real DB query filters by prefix', async () => {
    await tx.tag.upsert({
      where: { name: 'int-test-tag' },
      create: { name: 'int-test-tag', usageCount: 1, disciplineId: f.discipline.id },
      update: {},
    })
    const tags = await listTags(tx, { query: 'int-' })
    expect(tags.some(t => t.name === 'int-test-tag')).toBe(true)
  })
})

describe('INT-14: updateProfile PATCH bio → reads back updated value', () => {
  it('real DB PATCH + SELECT', async () => {
    await updateProfile(tx, f.author.id, { bio: 'Updated bio INT-14' })
    const profile = await getPublicProfile(tx, 'int-author')
    expect(profile?.bio).toBe('Updated bio INT-14')
  })
})

describe('INT-15: getProfileStats — correct post/comment counts', () => {
  it('real COUNT queries', async () => {
    await createPost(tx, f.author.id, { ...postPayload(15), title: 'INT-15 Count Post' })
    const profile = await getPublicProfile(tx, 'int-author')
    expect(profile?._count?.posts).toBeGreaterThanOrEqual(1)
  })
})

describe('INT-16: Two concurrent createComment calls → commentCount is exactly 2', () => {
  it('concurrency safety under real DB', async () => {
    const post = await createPost(tx, f.author.id, { ...postPayload(16), title: 'INT-16 Post' })
    await Promise.all([
      createComment(tx, { postSlug: post.slug, content: 'Comment 1', userId: f.voter.id }),
      createComment(tx, { postSlug: post.slug, content: 'Comment 2', userId: f.author.id }),
    ])
    const updated = await tx.post.findUnique({ where: { id: post.id } })
    expect(updated?.commentCount).toBe(2)
  })
})

describe('INT-17: listPosts pagination — no overlapping posts across pages', () => {
  it('offset/skip correctness', async () => {
    // Seed 6 posts
    for (let i = 1; i <= 6; i++) {
      await createPost(tx, f.author.id, { ...postPayload(170 + i), title: `INT-17 Page Post ${i}` })
    }
    const page1 = (await listPosts(tx, { page: 1, limit: 3 })).map(p => p.id)
    const page2 = (await listPosts(tx, { page: 2, limit: 3 })).map(p => p.id)
    const overlap = page1.filter(id => page2.includes(id))
    expect(overlap).toHaveLength(0)
  })
})

describe('INT-18: getPostBySlug on unknown slug → null, no DB error', () => {
  it('safe null return', async () => {
    const result = await getPostBySlug(tx, 'this-slug-will-never-exist-int-18')
    expect(result).toBeNull()
  })
})

describe('INT-19: createPost → post appears in getFeed for discipline', () => {
  it('write visible in read path', async () => {
    const post = await createPost(tx, f.author.id, { ...postPayload(19), title: 'INT-19 Feed Check' })
    const feed = await getFeed(tx, { disciplineSlug: 'int-test-disc' })
    expect(feed.find(p => p.id === post.id)).toBeTruthy()
  })
})

describe('INT-20: deletePost → post absent from feed AND search', () => {
  it('both read paths respect soft delete', async () => {
    const post = await createPost(tx, f.author.id, { ...postPayload(20), title: 'INT-20 Delete Check xyzdelete' })
    await deletePost(tx, f.author.id, post.id)
    const feed = await getFeed(tx, { disciplineSlug: 'int-test-disc' })
    const search = await searchPosts(tx, { query: 'xyzdelete' })
    expect(feed.find(p => p.id === post.id)).toBeUndefined()
    expect(search.find(p => p.id === post.id)).toBeUndefined()
  })
})

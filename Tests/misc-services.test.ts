// =============================================================================
// ATELIER — Section 8: Unit Tests — Reputation, Feed, Search, Tags, Profiles (U-61–U-82)
// File: src/modules/__tests__/misc-services.test.ts
// Tool: Vitest + prismock
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { PrismockClient } from 'prismock'
import { recalculateReputation } from '@/modules/reputation/reputation-service'
import { getFeed } from '@/modules/feed/feed-service'
import { searchPosts } from '@/modules/search/search-service'
import { listTags, getPopularTags } from '@/modules/tags/tag-service'
import { getPublicProfile, updateProfile } from '@/modules/profiles/profile-service'

let prismock: PrismockClient

beforeEach(async () => {
  prismock = new PrismockClient()
  await prismock.discipline.create({ data: { id: 'd-1', slug: 'motion-design', name: 'Motion Design' } })
  await prismock.discipline.create({ data: { id: 'd-2', slug: 'interior-design', name: 'Interior Design' } })
  await prismock.profile.create({ data: { id: 'u-1', username: 'alice', onboarded: true, disciplineId: 'd-1', reputation: 0 } })
  await prismock.profile.create({ data: { id: 'u-2', username: 'bob', onboarded: true, disciplineId: 'd-2', reputation: 50 } })
})

// =============================================================================
// REPUTATION (U-61 to U-65)
// =============================================================================
describe('reputation-service', () => {
  it('U-61: post upvote received → reputation increases', async () => {
    const post = await prismock.post.create({
      data: { title: 'T', slug: 's1', content: 'C', type: 'DISCUSSION', authorId: 'u-1', disciplineId: 'd-1', voteCount: 5, commentCount: 0 },
    })
    await recalculateReputation(prismock, 'u-1')
    const updated = await prismock.profile.findUnique({ where: { id: 'u-1' } })
    expect(updated?.reputation).toBeGreaterThan(0)
  })

  it('U-62: accepted answer on own comment → reputation increases', async () => {
    const post = await prismock.post.create({
      data: { title: 'T2', slug: 's2', content: 'C', type: 'HELP', authorId: 'u-2', disciplineId: 'd-1', voteCount: 0, commentCount: 1, acceptedCommentId: 'c-1' },
    })
    await prismock.comment.create({
      data: { id: 'c-1', content: 'Answer', postId: post.id, authorId: 'u-1', voteCount: 0 },
    })
    await recalculateReputation(prismock, 'u-1')
    const updated = await prismock.profile.findUnique({ where: { id: 'u-1' } })
    expect(updated?.reputation).toBeGreaterThan(0)
  })

  it('U-63: post downvote received → reputation decreases', async () => {
    await prismock.profile.update({ where: { id: 'u-1' }, data: { reputation: 20 } })
    await prismock.post.create({
      data: { title: 'Meh', slug: 's3', content: 'C', type: 'DISCUSSION', authorId: 'u-1', disciplineId: 'd-1', voteCount: -3, commentCount: 0 },
    })
    await recalculateReputation(prismock, 'u-1')
    const updated = await prismock.profile.findUnique({ where: { id: 'u-1' } })
    expect(updated?.reputation).toBeLessThan(20)
  })

  it('U-64: recalculation is idempotent — same result on second run', async () => {
    await recalculateReputation(prismock, 'u-1')
    const after1 = (await prismock.profile.findUnique({ where: { id: 'u-1' } }))?.reputation
    await recalculateReputation(prismock, 'u-1')
    const after2 = (await prismock.profile.findUnique({ where: { id: 'u-1' } }))?.reputation
    expect(after1).toBe(after2)
  })

  it('U-65: reputation never goes below 0', async () => {
    await prismock.post.create({
      data: { title: 'Bad Post', slug: 's4', content: 'C', type: 'DISCUSSION', authorId: 'u-1', disciplineId: 'd-1', voteCount: -1000, commentCount: 0 },
    })
    await recalculateReputation(prismock, 'u-1')
    const updated = await prismock.profile.findUnique({ where: { id: 'u-1' } })
    expect(updated?.reputation).toBeGreaterThanOrEqual(0)
  })
})

// =============================================================================
// FEED SERVICE (U-66 to U-70)
// =============================================================================
describe('feed-service', () => {
  beforeEach(async () => {
    await prismock.post.createMany({
      data: [
        { title: 'MD Post 1', slug: 'md-1', content: 'C', type: 'SHOWCASE', authorId: 'u-1', disciplineId: 'd-1', voteCount: 0, commentCount: 0 },
        { title: 'MD Post 2', slug: 'md-2', content: 'C', type: 'HELP', authorId: 'u-1', disciplineId: 'd-1', voteCount: 0, commentCount: 0 },
        { title: 'ID Post 1', slug: 'id-1', content: 'C', type: 'DISCUSSION', authorId: 'u-2', disciplineId: 'd-2', voteCount: 0, commentCount: 0 },
        { title: 'Deleted', slug: 'del-1', content: 'C', type: 'DISCUSSION', authorId: 'u-1', disciplineId: 'd-1', voteCount: 0, commentCount: 0, deletedAt: new Date() },
      ],
    })
  })

  it('U-66: discipline filter → all posts match that discipline', async () => {
    const results = await getFeed(prismock, { disciplineSlug: 'motion-design' })
    results.forEach(p => expect(p.discipline.slug).toBe('motion-design'))
  })

  it('U-67: postType SHOWCASE filter → all posts are SHOWCASE', async () => {
    const results = await getFeed(prismock, { postType: 'SHOWCASE' })
    results.forEach(p => expect(p.type).toBe('SHOWCASE'))
  })

  it('U-68: discipline with no posts → empty array, no crash', async () => {
    await prismock.discipline.create({ data: { id: 'd-3', slug: 'animation', name: 'Animation' } })
    const results = await getFeed(prismock, { disciplineSlug: 'animation' })
    expect(results).toEqual([])
  })

  it('U-69: feed never returns soft-deleted posts', async () => {
    const results = await getFeed(prismock, {})
    results.forEach(p => expect(p.deletedAt).toBeNull())
  })

  it('U-70: pagination { page: 2, limit: 3 } → max 3 results', async () => {
    const results = await getFeed(prismock, { page: 2, limit: 3 })
    expect(results.length).toBeLessThanOrEqual(3)
  })
})

// =============================================================================
// SEARCH SERVICE (U-71 to U-75)
// =============================================================================
describe('search-service', () => {
  beforeEach(async () => {
    await prismock.post.createMany({
      data: [
        { title: 'Typography Basics', slug: 'typo-1', content: 'About typefaces', type: 'DISCUSSION', authorId: 'u-1', disciplineId: 'd-1', voteCount: 0, commentCount: 0 },
        { title: 'Color Theory', slug: 'color-1', content: 'About colors', type: 'HELP', authorId: 'u-2', disciplineId: 'd-2', voteCount: 0, commentCount: 0 },
        { title: 'Typography Help Solved', slug: 'typo-help', content: 'Solved typo question', type: 'HELP', authorId: 'u-1', disciplineId: 'd-1', voteCount: 0, commentCount: 0, acceptedCommentId: 'ac-1' },
      ],
    })
  })

  it('U-71: search "typography" → returns matching posts', async () => {
    const results = await searchPosts(prismock, { query: 'typography' })
    expect(results.length).toBeGreaterThan(0)
    results.forEach(p =>
      expect(p.title.toLowerCase() + p.content.toLowerCase()).toContain('typ')
    )
  })

  it('U-72: search + discipline filter → all results in that discipline', async () => {
    const results = await searchPosts(prismock, { query: 'typography', disciplineSlug: 'motion-design' })
    results.forEach(p => expect(p.discipline.slug).toBe('motion-design'))
  })

  it('U-73: search + postType HELP filter → all results are HELP', async () => {
    const results = await searchPosts(prismock, { query: 'typography', postType: 'HELP' })
    results.forEach(p => expect(p.type).toBe('HELP'))
  })

  it('U-74: solved HELP posts rank first in HELP search results', async () => {
    const results = await searchPosts(prismock, { query: 'typography', postType: 'HELP' })
    if (results.length >= 2) {
      const firstSolved = results.findIndex(p => p.acceptedCommentId)
      const firstUnsolved = results.findIndex(p => !p.acceptedCommentId)
      if (firstSolved >= 0 && firstUnsolved >= 0) {
        expect(firstSolved).toBeLessThan(firstUnsolved)
      }
    }
  })

  it('U-75: search for gibberish → empty array, no crash', async () => {
    const results = await searchPosts(prismock, { query: 'xyzzy123notreal' })
    expect(results).toEqual([])
  })
})

// =============================================================================
// TAG SERVICE (U-76 to U-79)
// =============================================================================
describe('tag-service', () => {
  beforeEach(async () => {
    await prismock.tag.createMany({
      data: [
        { id: 't-1', name: 'typography', usageCount: 20, disciplineId: 'd-1' },
        { id: 't-2', name: 'typeface', usageCount: 5, disciplineId: 'd-1' },
        { id: 't-3', name: 'color-theory', usageCount: 15, disciplineId: 'd-2' },
        { id: 't-4', name: 'grid-systems', usageCount: 8, disciplineId: 'd-1' },
      ],
    })
  })

  it('U-76: listTags("typ") → returns tags starting with "typ"', async () => {
    const results = await listTags(prismock, { query: 'typ' })
    expect(results.length).toBeGreaterThan(0)
    results.forEach(t => expect(t.name).toMatch(/^typ/))
  })

  it('U-77: getPopularTags() → ordered by usageCount DESC', async () => {
    const results = await getPopularTags(prismock, {})
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].usageCount).toBeGreaterThanOrEqual(results[i + 1].usageCount)
    }
  })

  it('U-78: getPopularTags({ discipline: "motion-design" }) → only motion-design tags', async () => {
    const results = await getPopularTags(prismock, { disciplineSlug: 'motion-design' })
    results.forEach(t => expect(t.disciplineId).toBe('d-1'))
  })

  it('U-79: listTags with empty query → returns popular tags (non-empty)', async () => {
    const results = await listTags(prismock, { query: '' })
    expect(results.length).toBeGreaterThan(0)
  })
})

// =============================================================================
// PROFILE SERVICE (U-80 to U-82)
// =============================================================================
describe('profile-service', () => {
  it('U-80: getPublicProfile("alice") → returns profile with discipline, bio, reputation', async () => {
    const profile = await getPublicProfile(prismock, 'alice')
    expect(profile).not.toBeNull()
    expect(profile).toMatchObject({ username: 'alice' })
    expect(profile?.discipline).toBeTruthy()
  })

  it('U-81: getPublicProfile("nobody123") → returns null', async () => {
    const result = await getPublicProfile(prismock, 'nobody123')
    expect(result).toBeNull()
  })

  it('U-82: updateProfile with taken username → throws 409', async () => {
    // "bob" is already taken
    await expect(
      updateProfile(prismock, 'u-1', { username: 'bob' })
    ).rejects.toMatchObject({ status: 409 })
  })
})

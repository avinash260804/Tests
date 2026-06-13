// =============================================================================
// ATELIER — Section 4: Unit Tests — Post Service (U-19 to U-32)
// File: src/modules/posts/__tests__/post-service.test.ts
// Tool: Vitest + prismock
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PrismockClient } from 'prismock'
import { createPost, getPostBySlug, listPosts, updatePost, deletePost } from '@/modules/posts/post-service'
import { AppError } from '@/lib/handle-error'

let prismock: PrismockClient

const MOCK_USER = { id: 'user-1', onboarded: true }
const MOCK_DISCIPLINE = { id: 'disc-1', slug: 'interior-design', name: 'Interior Design' }

beforeEach(async () => {
  prismock = new PrismockClient()
  // Seed a discipline for FK references
  await prismock.discipline.create({ data: { id: 'disc-1', slug: 'interior-design', name: 'Interior Design' } })
})

const validPostInput = () => ({
  title: 'My First Post',
  content: 'Some body content',
  postType: 'DISCUSSION' as const,
  disciplineId: 'disc-1',
})

describe('createPost', () => {
  it('U-19: valid data → returns post with non-empty slug', async () => {
    const post = await createPost(prismock, MOCK_USER.id, validPostInput())
    expect(post.slug).toBeTruthy()
    expect(typeof post.slug).toBe('string')
  })

  it('U-20: missing disciplineId → throws validation error', async () => {
    const { disciplineId, ...rest } = validPostInput()
    await expect(createPost(prismock, MOCK_USER.id, rest as any)).rejects.toThrow()
  })

  it('U-21: missing title → throws validation error', async () => {
    const input = { ...validPostInput(), title: '' }
    await expect(createPost(prismock, MOCK_USER.id, input)).rejects.toThrow()
  })

  it('U-22: missing postType → throws validation error', async () => {
    const { postType, ...rest } = validPostInput()
    await expect(createPost(prismock, MOCK_USER.id, rest as any)).rejects.toThrow()
  })

  it('U-23: no auth (undefined userId) → throws 401', async () => {
    await expect(createPost(prismock, undefined as any, validPostInput()))
      .rejects.toMatchObject({ status: 401 })
  })
})

describe('getPostBySlug', () => {
  it('U-24: known slug → returns post object', async () => {
    const created = await createPost(prismock, MOCK_USER.id, validPostInput())
    const found = await getPostBySlug(prismock, created.slug)
    expect(found).not.toBeNull()
    expect(found?.slug).toBe(created.slug)
  })

  it('U-25: unknown slug → returns null', async () => {
    const result = await getPostBySlug(prismock, 'slug-that-does-not-exist')
    expect(result).toBeNull()
  })
})

describe('listPosts', () => {
  beforeEach(async () => {
    // Seed varied posts
    await createPost(prismock, MOCK_USER.id, { ...validPostInput(), postType: 'HELP' })
    await createPost(prismock, MOCK_USER.id, validPostInput())
    await createPost(prismock, 'user-2', { ...validPostInput(), title: 'Second Post' })
  })

  it('U-26: discipline filter → all returned posts match', async () => {
    const results = await listPosts(prismock, { disciplineSlug: 'interior-design' })
    results.forEach(p => expect(p.discipline.slug).toBe('interior-design'))
  })

  it('U-27: postType HELP filter → all posts are HELP', async () => {
    const results = await listPosts(prismock, { postType: 'HELP' })
    results.forEach(p => expect(p.type).toBe('HELP'))
  })

  it('U-28: page 2, limit 5 → max 5 items', async () => {
    const results = await listPosts(prismock, { page: 2, limit: 5 })
    expect(results.length).toBeLessThanOrEqual(5)
  })

  it('U-29: never returns soft-deleted posts', async () => {
    // Soft-delete the first post
    const posts = await listPosts(prismock, {})
    await prismock.post.update({
      where: { id: posts[0].id },
      data: { deletedAt: new Date() },
    })

    const results = await listPosts(prismock, {})
    results.forEach(p => expect(p.deletedAt).toBeNull())
  })
})

describe('updatePost', () => {
  it('U-30: non-author update → throws 403', async () => {
    const post = await createPost(prismock, 'user-author', validPostInput())
    await expect(
      updatePost(prismock, 'user-different', post.id, { title: 'Hacked' })
    ).rejects.toMatchObject({ status: 403 })
  })
})

describe('deletePost', () => {
  it('U-31: deletePost sets deletedAt (soft delete)', async () => {
    const post = await createPost(prismock, MOCK_USER.id, validPostInput())
    await deletePost(prismock, MOCK_USER.id, post.id)
    const updated = await prismock.post.findUnique({ where: { id: post.id } })
    expect(updated?.deletedAt).not.toBeNull()
  })

  it('U-32: after soft delete, listPosts does not include deleted post', async () => {
    const post = await createPost(prismock, MOCK_USER.id, validPostInput())
    await deletePost(prismock, MOCK_USER.id, post.id)
    const results = await listPosts(prismock, {})
    const found = results.find(p => p.id === post.id)
    expect(found).toBeUndefined()
  })
})

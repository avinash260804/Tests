// =============================================================================
// ATELIER — Section 5: Unit Tests — Comment Service (U-33 to U-42)
// File: src/modules/comments/__tests__/comment-service.test.ts
// Tool: Vitest + prismock
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { PrismockClient } from 'prismock'
import {
  createComment,
  listCommentsBySlug,
  deleteComment,
} from '@/modules/comments/comment-service'

let prismock: PrismockClient
let testPost: any

beforeEach(async () => {
  prismock = new PrismockClient()

  // Seed discipline + user + post
  await prismock.discipline.create({ data: { id: 'd-1', slug: 'motion-design', name: 'Motion Design' } })
  await prismock.profile.create({
    data: { id: 'user-1', username: 'alice', onboarded: true, disciplineId: 'd-1' },
  })
  testPost = await prismock.post.create({
    data: {
      title: 'Test Post',
      slug: 'test-post',
      content: 'Content',
      type: 'DISCUSSION',
      authorId: 'user-1',
      disciplineId: 'd-1',
      commentCount: 0,
    },
  })
})

describe('createComment', () => {
  it('U-33: createComment increments post commentCount atomically', async () => {
    const before = testPost.commentCount
    await createComment(prismock, { postSlug: 'test-post', content: 'Nice!', userId: 'user-1' })
    const updated = await prismock.post.findUnique({ where: { id: testPost.id } })
    expect(updated?.commentCount).toBe(before + 1)
  })

  it('U-34: createComment with no userId → throws 401', async () => {
    await expect(
      createComment(prismock, { postSlug: 'test-post', content: 'Nice!', userId: undefined as any })
    ).rejects.toMatchObject({ status: 401 })
  })

  it('U-35: createComment with onboarded:false → throws 403', async () => {
    await prismock.profile.update({ where: { id: 'user-1' }, data: { onboarded: false } })
    await expect(
      createComment(prismock, { postSlug: 'test-post', content: 'Nice!', userId: 'user-1' })
    ).rejects.toMatchObject({ status: 403 })
  })

  it('U-41: createComment on non-existent post → throws 404', async () => {
    await expect(
      createComment(prismock, { postSlug: 'no-such-post', content: 'Hi', userId: 'user-1' })
    ).rejects.toMatchObject({ status: 404 })
  })

  it('U-42: createComment on soft-deleted post → throws 404', async () => {
    await prismock.post.update({ where: { id: testPost.id }, data: { deletedAt: new Date() } })
    await expect(
      createComment(prismock, { postSlug: 'test-post', content: 'Hi', userId: 'user-1' })
    ).rejects.toMatchObject({ status: 404 })
  })
})

describe('listCommentsBySlug', () => {
  beforeEach(async () => {
    // Seed comments with varied vote counts
    await prismock.comment.createMany({
      data: [
        { id: 'c-1', content: 'Low votes', postId: testPost.id, authorId: 'user-1', voteCount: 2 },
        { id: 'c-2', content: 'High votes', postId: testPost.id, authorId: 'user-1', voteCount: 10 },
        { id: 'c-3', content: 'Deleted comment', postId: testPost.id, authorId: 'user-1', voteCount: 5, deletedAt: new Date() },
      ],
    })
  })

  it('U-36: returns comments ordered by voteCount DESC', async () => {
    const comments = await listCommentsBySlug(prismock, 'test-post')
    expect(comments[0].voteCount).toBeGreaterThanOrEqual(comments[1]?.voteCount ?? -Infinity)
  })

  it('U-37: post with no comments → returns empty array', async () => {
    const emptyPost = await prismock.post.create({
      data: { title: 'Empty', slug: 'empty-post', content: 'x', type: 'DISCUSSION', authorId: 'user-1', disciplineId: 'd-1', commentCount: 0 },
    })
    const result = await listCommentsBySlug(prismock, 'empty-post')
    expect(result).toEqual([])
  })

  it('U-38: excludes soft-deleted comments', async () => {
    const comments = await listCommentsBySlug(prismock, 'test-post')
    comments.forEach(c => expect(c.deletedAt).toBeNull())
  })
})

describe('deleteComment', () => {
  it('U-39: deleteComment soft-deletes — sets deletedAt', async () => {
    const comment = await prismock.comment.create({
      data: { content: 'I will be deleted', postId: testPost.id, authorId: 'user-1', voteCount: 0 },
    })
    await deleteComment(prismock, 'user-1', comment.id)
    const updated = await prismock.comment.findUnique({ where: { id: comment.id } })
    expect(updated?.deletedAt).not.toBeNull()
  })

  it('U-40: deleteComment by non-author → throws 403', async () => {
    const comment = await prismock.comment.create({
      data: { content: 'Protected', postId: testPost.id, authorId: 'user-1', voteCount: 0 },
    })
    await expect(deleteComment(prismock, 'user-intruder', comment.id))
      .rejects.toMatchObject({ status: 403 })
  })
})

// =============================================================================
// ATELIER — Section 7: Unit Tests — Vote Service (U-51 to U-60)
// File: src/modules/votes/__tests__/vote-service.test.ts
// Tool: Vitest + prismock
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { PrismockClient } from 'prismock'
import { voteOnPost, voteOnComment } from '@/modules/votes/vote-service'

let prismock: PrismockClient
let post: any
let comment: any

beforeEach(async () => {
  prismock = new PrismockClient()

  await prismock.discipline.create({ data: { id: 'd-1', slug: 'ux-design', name: 'UX Design' } })
  await prismock.profile.create({ data: { id: 'author-1', username: 'poster', onboarded: true, disciplineId: 'd-1' } })
  await prismock.profile.create({ data: { id: 'voter-1', username: 'voter', onboarded: true, disciplineId: 'd-1' } })

  post = await prismock.post.create({
    data: { title: 'Great Post', slug: 'great-post', content: 'Body', type: 'CRITIQUE', authorId: 'author-1', disciplineId: 'd-1', voteCount: 0, commentCount: 0 },
  })

  comment = await prismock.comment.create({
    data: { content: 'Great comment', postId: post.id, authorId: 'author-1', voteCount: 0 },
  })
})

describe('voteOnPost', () => {
  it('U-51: first upvote → creates record, voteCount +1', async () => {
    const result = await voteOnPost(prismock, { voterId: 'voter-1', postId: post.id, direction: 'UP' })
    expect(result.voteCount).toBe(1)
  })

  it('U-52: same direction again → removes vote (toggle off), voteCount -1', async () => {
    await voteOnPost(prismock, { voterId: 'voter-1', postId: post.id, direction: 'UP' })
    const result = await voteOnPost(prismock, { voterId: 'voter-1', postId: post.id, direction: 'UP' })
    expect(result.voteCount).toBe(0)
  })

  it('U-53: opposite direction → flips vote, voteCount changes by -2', async () => {
    await voteOnPost(prismock, { voterId: 'voter-1', postId: post.id, direction: 'UP' })
    const result = await voteOnPost(prismock, { voterId: 'voter-1', postId: post.id, direction: 'DOWN' })
    // +1 then flip to -1 = net change of -2 from the up-voted state
    expect(result.voteCount).toBe(-1)
  })

  it('U-54: self-vote → throws 403', async () => {
    await expect(voteOnPost(prismock, { voterId: 'author-1', postId: post.id, direction: 'UP' }))
      .rejects.toMatchObject({ status: 403 })
  })

  it('U-55: unauthenticated (no voterId) → throws 401', async () => {
    await expect(voteOnPost(prismock, { voterId: undefined as any, postId: post.id, direction: 'UP' }))
      .rejects.toMatchObject({ status: 401 })
  })

  it('U-60: vote on soft-deleted post → throws 404', async () => {
    await prismock.post.update({ where: { id: post.id }, data: { deletedAt: new Date() } })
    await expect(voteOnPost(prismock, { voterId: 'voter-1', postId: post.id, direction: 'UP' }))
      .rejects.toMatchObject({ status: 404 })
  })
})

describe('voteOnComment', () => {
  it('U-56: first upvote → creates record, voteCount +1', async () => {
    const result = await voteOnComment(prismock, { voterId: 'voter-1', commentId: comment.id, direction: 'UP' })
    expect(result.voteCount).toBe(1)
  })

  it('U-57: self-vote on comment → throws 403', async () => {
    await expect(voteOnComment(prismock, { voterId: 'author-1', commentId: comment.id, direction: 'UP' }))
      .rejects.toMatchObject({ status: 403 })
  })

  it('U-58: vote on soft-deleted comment → throws 404', async () => {
    await prismock.comment.update({ where: { id: comment.id }, data: { deletedAt: new Date() } })
    await expect(voteOnComment(prismock, { voterId: 'voter-1', commentId: comment.id, direction: 'UP' }))
      .rejects.toMatchObject({ status: 404 })
  })

  it('U-59: concurrent votes on same post → final count is consistent', async () => {
    // Simulate two simultaneous upvotes from different users
    await prismock.profile.create({ data: { id: 'voter-2', username: 'voter2', onboarded: true, disciplineId: 'd-1' } })
    await Promise.all([
      voteOnPost(prismock, { voterId: 'voter-1', postId: post.id, direction: 'UP' }),
      voteOnPost(prismock, { voterId: 'voter-2', postId: post.id, direction: 'UP' }),
    ])
    const final = await prismock.post.findUnique({ where: { id: post.id } })
    expect(final?.voteCount).toBe(2)
  })
})

// =============================================================================
// ATELIER — Section 6: Unit Tests — Help Solution Service (U-43 to U-50)
// File: src/modules/help/__tests__/help-solution-service.test.ts
// Tool: Vitest + prismock
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { PrismockClient } from 'prismock'
import { markAsSolved, clearSolved, getSolvedState } from '@/modules/help/help-solution-service'

let prismock: PrismockClient
let helpPost: any
let discussionPost: any
let comment: any

beforeEach(async () => {
  prismock = new PrismockClient()

  await prismock.discipline.create({ data: { id: 'd-1', slug: 'graphic-design', name: 'Graphic Design' } })
  await prismock.profile.create({ data: { id: 'author-1', username: 'owner', onboarded: true, disciplineId: 'd-1' } })
  await prismock.profile.create({ data: { id: 'user-2', username: 'commenter', onboarded: true, disciplineId: 'd-1' } })

  helpPost = await prismock.post.create({
    data: { title: 'Need help!', slug: 'need-help', content: 'Help me', type: 'HELP', authorId: 'author-1', disciplineId: 'd-1', commentCount: 1 },
  })

  discussionPost = await prismock.post.create({
    data: { title: 'Discussion', slug: 'discussion', content: 'Discuss', type: 'DISCUSSION', authorId: 'author-1', disciplineId: 'd-1', commentCount: 0 },
  })

  comment = await prismock.comment.create({
    data: { content: 'This is the answer', postId: helpPost.id, authorId: 'user-2', voteCount: 0 },
  })
})

describe('markAsSolved', () => {
  it('U-43: sets acceptedCommentId on post', async () => {
    await markAsSolved(prismock, 'author-1', helpPost.id, comment.id)
    const updated = await prismock.post.findUnique({ where: { id: helpPost.id } })
    expect(updated?.acceptedCommentId).toBe(comment.id)
  })

  it('U-44: by non-author → throws 403', async () => {
    await expect(markAsSolved(prismock, 'user-2', helpPost.id, comment.id))
      .rejects.toMatchObject({ status: 403 })
  })

  it('U-45: on DISCUSSION post → throws 400', async () => {
    await expect(markAsSolved(prismock, 'author-1', discussionPost.id, comment.id))
      .rejects.toMatchObject({ status: 400 })
  })

  it('U-46: with comment not belonging to this post → throws 400', async () => {
    const otherComment = await prismock.comment.create({
      data: { content: 'Unrelated', postId: discussionPost.id, authorId: 'user-2', voteCount: 0 },
    })
    await expect(markAsSolved(prismock, 'author-1', helpPost.id, otherComment.id))
      .rejects.toMatchObject({ status: 400 })
  })
})

describe('clearSolved', () => {
  beforeEach(async () => {
    await prismock.post.update({
      where: { id: helpPost.id },
      data: { acceptedCommentId: comment.id },
    })
  })

  it('U-47: removes acceptedCommentId (sets to null)', async () => {
    await clearSolved(prismock, 'author-1', helpPost.id)
    const updated = await prismock.post.findUnique({ where: { id: helpPost.id } })
    expect(updated?.acceptedCommentId).toBeNull()
  })

  it('U-48: by non-author → throws 403', async () => {
    await expect(clearSolved(prismock, 'user-2', helpPost.id))
      .rejects.toMatchObject({ status: 403 })
  })
})

describe('getSolvedState', () => {
  it('U-49: solved post → { solved: true }', async () => {
    await prismock.post.update({ where: { id: helpPost.id }, data: { acceptedCommentId: comment.id } })
    const state = await getSolvedState(prismock, helpPost.id)
    expect(state).toEqual({ solved: true })
  })

  it('U-50: new HELP post → { solved: false }', async () => {
    const state = await getSolvedState(prismock, helpPost.id)
    expect(state).toEqual({ solved: false })
  })
})

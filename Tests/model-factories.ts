/**
 * ATELIER — Test Data Factories
 * File: tests/factories/model-factories.ts
 *
 * Typed factory functions for every Prisma model used in unit,
 * component, snapshot, and form validation tests.
 *
 * Each factory accepts a partial override so tests only specify
 * the fields relevant to their assertion.
 *
 * Usage:
 *   import { makePost, makeProfile, makeComment } from '@tests/factories/model-factories'
 *
 *   const post = makePost({ title: 'My Custom Title' })
 *   const profile = makeProfile({ reputation: 500 })
 */

import { PostType } from '@prisma/client'

// ─── Counters for unique IDs ───────────────────────────────────────────────

let _seq = 0
const seq = () => String(++_seq).padStart(4, '0')

// ─── Discipline ────────────────────────────────────────────────────────────

export interface MockDiscipline {
  id: string
  name: string
  slug: string
  description: string | null
  postCount: number
  createdAt: Date
}

export function makeDiscipline(overrides: Partial<MockDiscipline> = {}): MockDiscipline {
  const n = seq()
  return {
    id: `disc-${n}`,
    name: `Discipline ${n}`,
    slug: `discipline-${n}`,
    description: `A test discipline (${n})`,
    postCount: 0,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }
}

// ─── Profile ───────────────────────────────────────────────────────────────

export interface MockProfile {
  id: string
  userId: string
  username: string
  displayName: string
  bio: string | null
  avatarUrl: string | null
  disciplineId: string | null
  discipline: MockDiscipline | null
  reputation: number
  onboarded: boolean
  skills: string[]
  softwares: string[]
  createdAt: Date
  updatedAt: Date
}

export function makeProfile(overrides: Partial<MockProfile> = {}): MockProfile {
  const n = seq()
  return {
    id: `profile-${n}`,
    userId: `user-${n}`,
    username: `testuser${n}`,
    displayName: `Test User ${n}`,
    bio: null,
    avatarUrl: null,
    disciplineId: null,
    discipline: null,
    reputation: 0,
    onboarded: true,
    skills: [],
    softwares: [],
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }
}

// ─── Post ──────────────────────────────────────────────────────────────────

export interface MockPost {
  id: string
  title: string
  slug: string
  content: string
  postType: PostType
  authorId: string
  author: MockProfile
  disciplineId: string
  discipline: MockDiscipline
  tags: MockTag[]
  voteCount: number
  commentCount: number
  acceptedCommentId: string | null
  imageUrl: string | null
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export function makePost(overrides: Partial<MockPost> = {}): MockPost {
  const n = seq()
  const author  = overrides.author     ?? makeProfile({ id: `profile-author-${n}`, userId: `user-author-${n}` })
  const disc    = overrides.discipline ?? makeDiscipline()
  return {
    id: `post-${n}`,
    title: `Test Post ${n}`,
    slug: `test-post-${n}`,
    content: `Content for test post ${n}. Lorem ipsum dolor sit amet.`,
    postType: PostType.DISCUSSION,
    authorId: author.id,
    author,
    disciplineId: disc.id,
    discipline: disc,
    tags: [],
    voteCount: 0,
    commentCount: 0,
    acceptedCommentId: null,
    imageUrl: null,
    deletedAt: null,
    createdAt: new Date('2024-06-01T10:00:00Z'),
    updatedAt: new Date('2024-06-01T10:00:00Z'),
    ...overrides,
  }
}

// Convenience variants
export const makeHelpPost    = (o: Partial<MockPost> = {}) => makePost({ postType: PostType.HELP,       ...o })
export const makeCritiquePost = (o: Partial<MockPost> = {}) => makePost({ postType: PostType.CRITIQUE,  ...o })
export const makeShowcasePost = (o: Partial<MockPost> = {}) => makePost({ postType: PostType.SHOWCASE,  ...o })
export const makeResourcePost = (o: Partial<MockPost> = {}) => makePost({ postType: PostType.RESOURCE,  ...o })

export const makeSolvedPost = (o: Partial<MockPost> = {}) =>
  makePost({ postType: PostType.HELP, acceptedCommentId: `comment-accepted-${seq()}`, ...o })

export const makeSoftDeletedPost = (o: Partial<MockPost> = {}) =>
  makePost({ deletedAt: new Date('2024-07-01T00:00:00Z'), ...o })

// ─── Comment ───────────────────────────────────────────────────────────────

export interface MockComment {
  id: string
  content: string
  postId: string
  authorId: string
  author: MockProfile
  voteCount: number
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export function makeComment(overrides: Partial<MockComment> = {}): MockComment {
  const n      = seq()
  const author = overrides.author ?? makeProfile({ id: `profile-commenter-${n}`, userId: `user-commenter-${n}` })
  return {
    id: `comment-${n}`,
    content: `This is test comment ${n}.`,
    postId: `post-ref-${n}`,
    authorId: author.id,
    author,
    voteCount: 0,
    deletedAt: null,
    createdAt: new Date('2024-06-01T11:00:00Z'),
    updatedAt: new Date('2024-06-01T11:00:00Z'),
    ...overrides,
  }
}

export const makeSoftDeletedComment = (o: Partial<MockComment> = {}) =>
  makeComment({ deletedAt: new Date('2024-07-01T00:00:00Z'), ...o })

// ─── Vote ──────────────────────────────────────────────────────────────────

export type VoteDirection = 'UP' | 'DOWN'
export type VoteTargetType = 'POST' | 'COMMENT'

export interface MockVote {
  id: string
  authorId: string
  postId: string | null
  commentId: string | null
  direction: VoteDirection
  createdAt: Date
}

export function makeVote(overrides: Partial<MockVote> = {}): MockVote {
  const n = seq()
  return {
    id: `vote-${n}`,
    authorId: `user-voter-${n}`,
    postId: `post-ref-${n}`,
    commentId: null,
    direction: 'UP',
    createdAt: new Date('2024-06-01T12:00:00Z'),
    ...overrides,
  }
}

// ─── Tag ───────────────────────────────────────────────────────────────────

export interface MockTag {
  id: string
  name: string
  slug: string
  usageCount: number
  disciplineId: string | null
}

export function makeTag(overrides: Partial<MockTag> = {}): MockTag {
  const n = seq()
  return {
    id: `tag-${n}`,
    name: `tag-${n}`,
    slug: `tag-${n}`,
    usageCount: 0,
    disciplineId: null,
    ...overrides,
  }
}

// ─── Paginated list helper ─────────────────────────────────────────────────

export interface PaginatedResult<T> {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    hasMore: boolean
  }
}

export function makePaginatedResult<T>(
  data: T[],
  opts: { page?: number; limit?: number; total?: number } = {},
): PaginatedResult<T> {
  const page  = opts.page  ?? 1
  const limit = opts.limit ?? 20
  const total = opts.total ?? data.length
  return {
    data,
    meta: {
      total,
      page,
      limit,
      hasMore: page * limit < total,
    },
  }
}

// ─── Stats ─────────────────────────────────────────────────────────────────

export interface MockStats {
  members: number
  posts: number
  disciplines: number
}

export function makeStats(overrides: Partial<MockStats> = {}): MockStats {
  return {
    members: 1200,
    posts: 4800,
    disciplines: 12,
    ...overrides,
  }
}

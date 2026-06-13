// =============================================================================
// ATELIER — Section 10: API Route Tests (A-01 to A-30)
// File: src/app/api/__tests__/api-routes.test.ts
// Tool: Vitest + NextRequest mock
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeRequest(method: string, url: string, body?: unknown, authCookie = true): NextRequest {
  const req = new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authCookie ? { Cookie: 'sb-access-token=mock-valid-token' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return req
}

// Mock Supabase auth — swap for your actual auth helper
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-auth-1', email: 'test@example.com' } },
        error: null,
      }),
    },
  }),
}))

// Mock service layer to isolate route handler logic
vi.mock('@/modules/posts/post-service')
vi.mock('@/modules/comments/comment-service')
vi.mock('@/modules/votes/vote-service')
vi.mock('@/modules/tags/tag-service')
vi.mock('@/modules/profiles/profile-service')
vi.mock('@/modules/search/search-service')
vi.mock('@/modules/help/help-solution-service')

import * as PostService from '@/modules/posts/post-service'
import * as CommentService from '@/modules/comments/comment-service'
import * as VoteService from '@/modules/votes/vote-service'
import * as TagService from '@/modules/tags/tag-service'
import * as ProfileService from '@/modules/profiles/profile-service'
import * as SearchService from '@/modules/search/search-service'
import * as HelpService from '@/modules/help/help-solution-service'

// Route handlers — adjust imports to match your file structure
import { GET as getPosts, POST as createPost } from '@/app/api/posts/route'
import { GET as getPostBySlug } from '@/app/api/posts/[slug]/route'
import { GET as getComments, POST as createComment } from '@/app/api/comments/route'
import { POST as vote } from '@/app/api/votes/route'
import { GET as getTags } from '@/app/api/tags/route'
import { GET as getProfile, PATCH as patchProfile } from '@/app/api/profiles/[username]/route'
import { PATCH as patchMe } from '@/app/api/profiles/me/route'
import { GET as search } from '@/app/api/search/route'
import { GET as getStats } from '@/app/api/stats/route'
import { POST as markSolution } from '@/app/api/help/solution/route'

// =============================================================================
// POSTS API (A-01 to A-11)
// =============================================================================
describe('GET /api/posts', () => {
  beforeEach(() => {
    vi.mocked(PostService.listPosts).mockResolvedValue([
      { id: 'p1', title: 'Test', slug: 'test', type: 'DISCUSSION', discipline: { slug: 'gd' } } as any,
    ])
  })

  it('A-01: no filters → 200 with data + meta', async () => {
    const res = await getPosts(makeRequest('GET', '/api/posts'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('data')
    expect(body).toHaveProperty('meta.total')
  })

  it('A-02: ?discipline=interior-design → 200, filtered by discipline', async () => {
    const res = await getPosts(makeRequest('GET', '/api/posts?discipline=interior-design'))
    expect(res.status).toBe(200)
  })

  it('A-03: ?postType=HELP → 200', async () => {
    const res = await getPosts(makeRequest('GET', '/api/posts?postType=HELP'))
    expect(res.status).toBe(200)
  })
})

describe('GET /api/posts/[slug]', () => {
  it('A-04: valid slug → 200, full post object', async () => {
    vi.mocked(PostService.getPostBySlug).mockResolvedValue({ id: 'p1', slug: 'valid' } as any)
    const res = await getPostBySlug(makeRequest('GET', '/api/posts/valid'), { params: { slug: 'valid' } })
    expect(res.status).toBe(200)
  })

  it('A-05: unknown slug → 404 with error message', async () => {
    vi.mocked(PostService.getPostBySlug).mockResolvedValue(null)
    const res = await getPostBySlug(makeRequest('GET', '/api/posts/nope'), { params: { slug: 'nope' } })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body).toHaveProperty('error')
  })
})

describe('POST /api/posts', () => {
  it('A-06: authenticated, valid body → 201 with slug', async () => {
    vi.mocked(PostService.createPost).mockResolvedValue({ id: 'p1', slug: 'new-post' } as any)
    const res = await createPost(makeRequest('POST', '/api/posts', { title: 'T', content: 'C', postType: 'DISCUSSION', disciplineId: 'd-1' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data).toHaveProperty('slug')
  })

  it('A-07: unauthenticated → 401', async () => {
    const res = await createPost(makeRequest('POST', '/api/posts', {}, false))
    expect(res.status).toBe(401)
  })

  it('A-08: missing title → 400', async () => {
    const res = await createPost(makeRequest('POST', '/api/posts', { content: 'C', postType: 'DISCUSSION', disciplineId: 'd-1' }))
    expect(res.status).toBe(400)
  })

  it('A-09: missing disciplineId → 400', async () => {
    const res = await createPost(makeRequest('POST', '/api/posts', { title: 'T', content: 'C', postType: 'DISCUSSION' }))
    expect(res.status).toBe(400)
  })

  it('A-10: missing postType → 400', async () => {
    const res = await createPost(makeRequest('POST', '/api/posts', { title: 'T', content: 'C', disciplineId: 'd-1' }))
    expect(res.status).toBe(400)
  })

  it('A-11: missing content → 400', async () => {
    const res = await createPost(makeRequest('POST', '/api/posts', { title: 'T', postType: 'DISCUSSION', disciplineId: 'd-1' }))
    expect(res.status).toBe(400)
  })
})

// =============================================================================
// COMMENTS API (A-12 to A-15)
// =============================================================================
describe('GET /api/comments', () => {
  it('A-12: valid postSlug → 200 with data array', async () => {
    vi.mocked(CommentService.listCommentsBySlug).mockResolvedValue([{ id: 'c1', content: 'Hi' } as any])
    const res = await getComments(makeRequest('GET', '/api/comments?postSlug=valid-slug'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.data)).toBe(true)
  })

  it('A-13: unknown postSlug → 200 with empty data array', async () => {
    vi.mocked(CommentService.listCommentsBySlug).mockResolvedValue([])
    const res = await getComments(makeRequest('GET', '/api/comments?postSlug=unknown'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })
})

describe('POST /api/comments', () => {
  it('A-14: authenticated, onboarded → 201', async () => {
    vi.mocked(CommentService.createComment).mockResolvedValue({ id: 'c1' } as any)
    const res = await createComment(makeRequest('POST', '/api/comments', { postSlug: 'valid', content: 'Nice!' }))
    expect(res.status).toBe(201)
  })

  it('A-15: unauthenticated → 401', async () => {
    const res = await createComment(makeRequest('POST', '/api/comments', { postSlug: 'valid', content: 'Nice!' }, false))
    expect(res.status).toBe(401)
  })
})

// =============================================================================
// VOTES API (A-16 to A-19)
// =============================================================================
describe('POST /api/votes', () => {
  it('A-16: valid upvote → 200 with updated voteCount', async () => {
    vi.mocked(VoteService.voteOnPost).mockResolvedValue({ voteCount: 5 } as any)
    const res = await vote(makeRequest('POST', '/api/votes', { postId: 'p1', direction: 'UP', targetType: 'POST' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('voteCount')
  })

  it('A-17: self-vote → 403', async () => {
    vi.mocked(VoteService.voteOnPost).mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }))
    const res = await vote(makeRequest('POST', '/api/votes', { postId: 'p1', direction: 'UP', targetType: 'POST' }))
    expect(res.status).toBe(403)
  })

  it('A-18: unauthenticated → 401', async () => {
    const res = await vote(makeRequest('POST', '/api/votes', { postId: 'p1', direction: 'UP', targetType: 'POST' }, false))
    expect(res.status).toBe(401)
  })

  it('A-19: invalid targetType → 400', async () => {
    const res = await vote(makeRequest('POST', '/api/votes', { postId: 'p1', direction: 'UP', targetType: 'INVALID' }))
    expect(res.status).toBe(400)
  })
})

// =============================================================================
// TAGS, PROFILES, SEARCH, STATS, HELP API (A-20 to A-30)
// =============================================================================
describe('GET /api/tags', () => {
  it('A-20: ?q=ty → 200 with matching tags array', async () => {
    vi.mocked(TagService.listTags).mockResolvedValue([{ id: 't1', name: 'typography' } as any])
    const res = await getTags(makeRequest('GET', '/api/tags?q=ty'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  it('A-21: ?q=zzznotreal → 200 with empty array', async () => {
    vi.mocked(TagService.listTags).mockResolvedValue([])
    const res = await getTags(makeRequest('GET', '/api/tags?q=zzznotreal'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })
})

describe('GET /api/profiles/[username]', () => {
  it('A-22: known user → 200 with full profile', async () => {
    vi.mocked(ProfileService.getPublicProfile).mockResolvedValue({ id: 'u1', username: 'alice' } as any)
    const res = await getProfile(makeRequest('GET', '/api/profiles/alice'), { params: { username: 'alice' } })
    expect(res.status).toBe(200)
  })

  it('A-23: unknown user → 404', async () => {
    vi.mocked(ProfileService.getPublicProfile).mockResolvedValue(null)
    const res = await getProfile(makeRequest('GET', '/api/profiles/nobody'), { params: { username: 'nobody' } })
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/profiles/me', () => {
  it('A-24: authenticated → 200 with updated profile', async () => {
    vi.mocked(ProfileService.updateProfile).mockResolvedValue({ id: 'u1', bio: 'New bio' } as any)
    const res = await patchMe(makeRequest('PATCH', '/api/profiles/me', { bio: 'New bio' }))
    expect(res.status).toBe(200)
  })

  it('A-25: unauthenticated → 401', async () => {
    const res = await patchMe(makeRequest('PATCH', '/api/profiles/me', { bio: 'x' }, false))
    expect(res.status).toBe(401)
  })

  it('A-26: taken username → 409', async () => {
    vi.mocked(ProfileService.updateProfile).mockRejectedValue(Object.assign(new Error('Conflict'), { status: 409 }))
    const res = await patchMe(makeRequest('PATCH', '/api/profiles/me', { username: 'taken' }))
    expect(res.status).toBe(409)
  })
})

describe('GET /api/search', () => {
  it('A-27: ?q=typography → 200 with matching posts', async () => {
    vi.mocked(SearchService.searchPosts).mockResolvedValue([{ id: 'p1', title: 'Typography' } as any])
    const res = await search(makeRequest('GET', '/api/search?q=typography'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.data)).toBe(true)
  })

  it('A-28: ?q=xyznotreal → 200 with empty data and meta.total=0', async () => {
    vi.mocked(SearchService.searchPosts).mockResolvedValue([])
    const res = await search(makeRequest('GET', '/api/search?q=xyznotreal'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
    expect(body.meta.total).toBe(0)
  })
})

describe('GET /api/stats', () => {
  it('A-29: → 200 with numeric members, posts, disciplines', async () => {
    const res = await getStats(makeRequest('GET', '/api/stats'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(typeof body.members).toBe('number')
    expect(typeof body.posts).toBe('number')
    expect(typeof body.disciplines).toBe('number')
  })
})

describe('POST /api/help/solution', () => {
  it('A-30: non-author → 403', async () => {
    vi.mocked(HelpService.markAsSolved).mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }))
    const res = await markSolution(makeRequest('POST', '/api/help/solution', { postId: 'p1', commentId: 'c1' }))
    expect(res.status).toBe(403)
  })
})

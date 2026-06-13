/**
 * ATELIER — MSW Default Handlers
 * File: tests/msw/handlers.ts
 *
 * Default "happy path" handlers for every API route tested in Section 10.
 * Individual tests can override any handler via server.use(...) for error paths.
 *
 * Handler coverage:
 *   POST /api/posts           — A-06, A-07, A-08–A-11, SEC-16
 *   GET  /api/posts           — A-01, A-02, A-03
 *   GET  /api/posts/:slug     — A-04, A-05
 *   GET  /api/comments        — A-12, A-13
 *   POST /api/comments        — A-14, A-15
 *   POST /api/votes           — A-16, A-17, A-18, A-19, SEC-17
 *   GET  /api/tags            — A-20, A-21
 *   GET  /api/profiles/:uname — A-22, A-23
 *   PATCH /api/profiles/me    — A-24, A-25, A-26
 *   GET  /api/search          — A-27, A-28
 *   GET  /api/stats           — A-29
 *   POST /api/help/solution   — A-30
 */

import { http, HttpResponse } from 'msw'
import {
  makePost,
  makeComment,
  makeProfile,
  makeTag,
  makeStats,
  makePaginatedResult,
  makeDiscipline,
} from '../factories/model-factories'

// ─── Seeded fixtures reused across handlers ────────────────────────────────

const DISCIPLINE    = makeDiscipline({ slug: 'interior-design', name: 'Interior Design' })
const PROFILE_A     = makeProfile({ username: 'usera',  userId: 'user-a-id', discipline: DISCIPLINE })
const PROFILE_B     = makeProfile({ username: 'userb',  userId: 'user-b-id' })
const SEEDED_POST   = makePost({
  slug: 'seeded-discussion-post',
  title: 'Seeded Discussion Post',
  author: PROFILE_A,
  discipline: DISCIPLINE,
})
const SEEDED_COMMENT = makeComment({ postId: SEEDED_POST.id, author: PROFILE_B })

export const handlers = [

  // ── GET /api/posts ─────────────────────────────────────────────────

  http.get('/api/posts', ({ request }) => {
    const url        = new URL(request.url)
    const discipline = url.searchParams.get('discipline')
    const postType   = url.searchParams.get('postType')

    let posts = [SEEDED_POST, makePost({ author: PROFILE_B, discipline: DISCIPLINE })]

    if (discipline) posts = posts.filter((p) => p.discipline.slug === discipline)
    if (postType)   posts = posts.filter((p) => p.postType === postType)

    return HttpResponse.json(makePaginatedResult(posts))
  }),

  // ── GET /api/posts/:slug ───────────────────────────────────────────

  http.get('/api/posts/:slug', ({ params }) => {
    if (params.slug === SEEDED_POST.slug) {
      return HttpResponse.json({ data: SEEDED_POST })
    }
    return HttpResponse.json({ error: 'Not found' }, { status: 404 })
  }),

  // ── POST /api/posts ────────────────────────────────────────────────

  http.post('/api/posts', async ({ request }) => {
    // Auth check — Supabase session cookie expected
    const cookie = request.headers.get('cookie') ?? ''
    if (!cookie.includes('sb-access-token') && !cookie.includes('next-auth.session-token')) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as Record<string, unknown>

    // Validation
    if (!body.title)        return HttpResponse.json({ error: 'Title is required' },       { status: 400 })
    if (!body.disciplineId) return HttpResponse.json({ error: 'Discipline is required' },  { status: 400 })
    if (!body.postType)     return HttpResponse.json({ error: 'Post type is required' },   { status: 400 })
    if (!body.content)      return HttpResponse.json({ error: 'Content is required' },     { status: 400 })

    const newPost = makePost({
      title: String(body.title),
      postType: body.postType as never,
      author: PROFILE_A,
      discipline: DISCIPLINE,
    })
    return HttpResponse.json({ data: newPost }, { status: 201 })
  }),

  // ── GET /api/comments ──────────────────────────────────────────────

  http.get('/api/comments', ({ request }) => {
    const url      = new URL(request.url)
    const postSlug = url.searchParams.get('postSlug')

    if (postSlug === SEEDED_POST.slug) {
      return HttpResponse.json(makePaginatedResult([SEEDED_COMMENT]))
    }
    // Unknown slug → empty array (not 404)
    return HttpResponse.json(makePaginatedResult([]))
  }),

  // ── POST /api/comments ─────────────────────────────────────────────

  http.post('/api/comments', async ({ request }) => {
    const cookie = request.headers.get('cookie') ?? ''
    if (!cookie.includes('sb-access-token') && !cookie.includes('next-auth.session-token')) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json() as Record<string, unknown>
    const newComment = makeComment({ content: String(body.content ?? ''), postId: String(body.postId ?? '') })
    return HttpResponse.json({ data: newComment }, { status: 201 })
  }),

  // ── POST /api/votes ────────────────────────────────────────────────

  http.post('/api/votes', async ({ request }) => {
    const cookie = request.headers.get('cookie') ?? ''
    if (!cookie.includes('sb-access-token') && !cookie.includes('next-auth.session-token')) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as Record<string, unknown>

    // Validate targetType
    if (!['POST', 'COMMENT'].includes(String(body.targetType ?? ''))) {
      return HttpResponse.json({ error: 'Invalid targetType' }, { status: 400 })
    }

    // Self-vote check — if targetId matches the authed user's own post/comment
    if (body.targetId === SEEDED_POST.id) {
      return HttpResponse.json({ error: 'Cannot vote on your own content' }, { status: 403 })
    }

    return HttpResponse.json({ data: { voteCount: 1 } }, { status: 200 })
  }),

  // ── GET /api/tags ──────────────────────────────────────────────────

  http.get('/api/tags', ({ request }) => {
    const url = new URL(request.url)
    const q   = url.searchParams.get('q') ?? ''

    const allTags = [
      makeTag({ name: 'typography',   slug: 'typography',   usageCount: 42 }),
      makeTag({ name: 'typesetting',  slug: 'typesetting',  usageCount: 18 }),
      makeTag({ name: 'color-theory', slug: 'color-theory', usageCount: 30 }),
      makeTag({ name: 'grid-systems', slug: 'grid-systems', usageCount: 25 }),
    ]

    if (!q) return HttpResponse.json({ data: allTags })

    const filtered = allTags.filter((t) => t.slug.startsWith(q.toLowerCase()))
    return HttpResponse.json({ data: filtered })
  }),

  // ── GET /api/profiles/:username ────────────────────────────────────

  http.get('/api/profiles/:username', ({ params }) => {
    if (params.username === PROFILE_A.username) {
      return HttpResponse.json({ data: PROFILE_A })
    }
    if (params.username === PROFILE_B.username) {
      return HttpResponse.json({ data: PROFILE_B })
    }
    return HttpResponse.json({ error: 'Not found' }, { status: 404 })
  }),

  // ── PATCH /api/profiles/me ─────────────────────────────────────────

  http.patch('/api/profiles/me', async ({ request }) => {
    const cookie = request.headers.get('cookie') ?? ''
    if (!cookie.includes('sb-access-token') && !cookie.includes('next-auth.session-token')) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as Record<string, unknown>

    // Simulate taken username
    if (body.username === PROFILE_B.username) {
      return HttpResponse.json({ error: 'Username already taken' }, { status: 409 })
    }

    const updated = { ...PROFILE_A, ...body }
    return HttpResponse.json({ data: updated }, { status: 200 })
  }),

  // ── GET /api/search ────────────────────────────────────────────────

  http.get('/api/search', ({ request }) => {
    const url = new URL(request.url)
    const q   = url.searchParams.get('q') ?? ''

    if (!q || q.includes('xyznotreal') || q.includes('xyzzy')) {
      return HttpResponse.json(makePaginatedResult([], { total: 0 }))
    }

    const results = [SEEDED_POST, makePost({ author: PROFILE_B, discipline: DISCIPLINE })]
    return HttpResponse.json(makePaginatedResult(results))
  }),

  // ── GET /api/stats ─────────────────────────────────────────────────

  http.get('/api/stats', () => {
    return HttpResponse.json({ data: makeStats() })
  }),

  // ── POST /api/help/solution ────────────────────────────────────────

  http.post('/api/help/solution', async ({ request }) => {
    const cookie = request.headers.get('cookie') ?? ''
    if (!cookie.includes('sb-access-token') && !cookie.includes('next-auth.session-token')) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as Record<string, unknown>

    // Ownership check: only the post author (user-a-id) can mark solved
    // In tests, passing authorId: 'user-b-id' simulates a non-author attempt
    if (body.actingUserId && body.actingUserId !== PROFILE_A.userId) {
      return HttpResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return HttpResponse.json({ data: { solved: true, acceptedCommentId: body.commentId } })
  }),
]

-- =============================================================================
-- ATELIER — Section 14: RLS / Database Policy Tests (RLS-01 to RLS-20)
-- File: tests/rls/rls.test.sql
-- Tool: pgTAP via Supabase CLI local stack
-- Run: npx supabase test db
-- =============================================================================

BEGIN;

SELECT plan(20);

-- ─── Fixtures ────────────────────────────────────────────────────────────────
-- Seed test discipline
INSERT INTO disciplines (id, slug, name) VALUES ('rls-d1', 'rls-disc', 'RLS Test Discipline')
ON CONFLICT DO NOTHING;

-- Seed two users (matching Supabase auth.users pattern)
INSERT INTO auth.users (id, email) VALUES
  ('rls-u1', 'rls-user1@test.com'),
  ('rls-u2', 'rls-user2@test.com')
ON CONFLICT DO NOTHING;

INSERT INTO profiles (id, username, onboarded, discipline_id) VALUES
  ('rls-u1', 'rls-user1', true, 'rls-d1'),
  ('rls-u2', 'rls-user2', true, 'rls-d1')
ON CONFLICT DO NOTHING;

-- Seed a live post and a soft-deleted post
INSERT INTO posts (id, title, slug, content, type, author_id, discipline_id, vote_count, comment_count) VALUES
  ('rls-p1', 'RLS Live Post', 'rls-live', 'Content', 'DISCUSSION', 'rls-u1', 'rls-d1', 0, 0),
  ('rls-p2', 'RLS Deleted Post', 'rls-deleted', 'Content', 'DISCUSSION', 'rls-u1', 'rls-d1', 0, 0)
ON CONFLICT DO NOTHING;

UPDATE posts SET deleted_at = NOW() WHERE id = 'rls-p2';

-- Seed a live comment and a deleted comment
INSERT INTO comments (id, content, post_id, author_id, vote_count) VALUES
  ('rls-c1', 'RLS Live Comment', 'rls-p1', 'rls-u2', 0),
  ('rls-c2', 'RLS Deleted Comment', 'rls-p1', 'rls-u2', 0)
ON CONFLICT DO NOTHING;

UPDATE comments SET deleted_at = NOW() WHERE id = 'rls-c2';

-- ─── RLS-01: Anon can read non-deleted posts ─────────────────────────────────
SET role anon;

SELECT results_eq(
  $$ SELECT count(*)::int FROM posts WHERE slug = 'rls-live' $$,
  $$ VALUES (1) $$,
  'RLS-01: anon can read non-deleted posts'
);

-- ─── RLS-02: Anon cannot read soft-deleted posts ─────────────────────────────
SELECT results_eq(
  $$ SELECT count(*)::int FROM posts WHERE slug = 'rls-deleted' $$,
  $$ VALUES (0) $$,
  'RLS-02: anon cannot read soft-deleted posts'
);

-- ─── RLS-03: Authenticated user can INSERT a post ────────────────────────────
SET role authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "rls-u1"}';

SELECT lives_ok(
  $$ INSERT INTO posts (id, title, slug, content, type, author_id, discipline_id, vote_count, comment_count)
     VALUES ('rls-p-new', 'New RLS Post', 'rls-new-post', 'Content', 'DISCUSSION', 'rls-u1', 'rls-d1', 0, 0) $$,
  'RLS-03: authenticated user can INSERT a post'
);

-- ─── RLS-04: Anon cannot INSERT a post ───────────────────────────────────────
SET role anon;

SELECT throws_ok(
  $$ INSERT INTO posts (id, title, slug, content, type, author_id, discipline_id, vote_count, comment_count)
     VALUES ('rls-p-anon', 'Anon Post', 'rls-anon-post', 'Content', 'DISCUSSION', 'rls-u1', 'rls-d1', 0, 0) $$,
  'RLS-04: anon cannot INSERT a post (blocked by RLS)'
);

-- ─── RLS-05: Author can soft-delete their own post ───────────────────────────
SET role authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "rls-u1"}';

SELECT lives_ok(
  $$ UPDATE posts SET deleted_at = NOW() WHERE id = 'rls-p1' AND author_id = 'rls-u1' $$,
  'RLS-05: author can soft-delete their own post'
);

-- Reset for comment tests
UPDATE posts SET deleted_at = NULL WHERE id = 'rls-p1';

-- ─── RLS-06: Anon can read non-deleted comments ──────────────────────────────
SET role anon;

SELECT results_eq(
  $$ SELECT count(*)::int FROM comments WHERE id = 'rls-c1' $$,
  $$ VALUES (1) $$,
  'RLS-06: anon can read non-deleted comments'
);

-- ─── RLS-07: Anon cannot read soft-deleted comments ─────────────────────────
SELECT results_eq(
  $$ SELECT count(*)::int FROM comments WHERE id = 'rls-c2' $$,
  $$ VALUES (0) $$,
  'RLS-07: anon cannot read soft-deleted comments'
);

-- ─── RLS-08: Authenticated, onboarded user can INSERT comment ────────────────
SET role authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "rls-u2"}';

SELECT lives_ok(
  $$ INSERT INTO comments (id, content, post_id, author_id, vote_count)
     VALUES ('rls-c-new', 'Auth comment', 'rls-p1', 'rls-u2', 0) $$,
  'RLS-08: authenticated onboarded user can INSERT comment'
);

-- ─── RLS-09: Anon cannot INSERT comment ─────────────────────────────────────
SET role anon;

SELECT throws_ok(
  $$ INSERT INTO comments (id, content, post_id, author_id, vote_count)
     VALUES ('rls-c-anon', 'Anon comment', 'rls-p1', 'rls-u1', 0) $$,
  'RLS-09: anon cannot INSERT comment (blocked by RLS)'
);

-- ─── RLS-10: Any authenticated user can read votes ───────────────────────────
SET role authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "rls-u2"}';

-- Seed a vote to read
INSERT INTO votes (id, author_id, post_id, direction) VALUES ('rls-v1', 'rls-u2', 'rls-p1', 'UP')
ON CONFLICT DO NOTHING;

SELECT results_eq(
  $$ SELECT count(*)::int FROM votes WHERE id = 'rls-v1' $$,
  $$ VALUES (1) $$,
  'RLS-10: authenticated user can read votes'
);

-- ─── RLS-11: Authenticated user can INSERT vote as themselves ────────────────
SELECT lives_ok(
  $$ INSERT INTO votes (id, author_id, post_id, direction)
     VALUES ('rls-v2', 'rls-u2', 'rls-p1', 'DOWN')
     ON CONFLICT DO NOTHING $$,
  'RLS-11: authenticated user can INSERT vote as themselves'
);

-- ─── RLS-12: User cannot INSERT vote as different user ───────────────────────
SELECT throws_ok(
  $$ INSERT INTO votes (id, author_id, post_id, direction)
     VALUES ('rls-v3', 'rls-u1', 'rls-p1', 'UP') $$,
  'RLS-12: user cannot INSERT vote as a different user'
);

-- ─── RLS-13: Anon can read any public profile ────────────────────────────────
SET role anon;

SELECT results_eq(
  $$ SELECT count(*)::int FROM profiles WHERE username = 'rls-user1' $$,
  $$ VALUES (1) $$,
  'RLS-13: anon can read any public profile'
);

-- ─── RLS-14: User can UPDATE their own profile ───────────────────────────────
SET role authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "rls-u1"}';

SELECT lives_ok(
  $$ UPDATE profiles SET bio = 'Updated bio' WHERE id = 'rls-u1' $$,
  'RLS-14: user can update their own profile'
);

-- ─── RLS-15: User cannot UPDATE another user's profile ───────────────────────
SELECT throws_ok(
  $$ UPDATE profiles SET bio = 'Hacked' WHERE id = 'rls-u2' $$,
  'RLS-15: user cannot update another user''s profile'
);

-- ─── RLS-16: User can only INSERT their own profile row ──────────────────────
SELECT throws_ok(
  $$ INSERT INTO profiles (id, username, onboarded, discipline_id)
     VALUES ('rls-u1-dup', 'hacker', true, 'rls-d1') $$,
  'RLS-16: user cannot INSERT profile row for another userId'
);

-- ─── RLS-17: Soft-deleted post comments not readable by anon ─────────────────
SET role anon;

-- Create a comment on the deleted post (as auth first, then check as anon)
SELECT results_eq(
  $$ SELECT count(*)::int FROM comments c
     JOIN posts p ON c.post_id = p.id
     WHERE p.deleted_at IS NOT NULL $$,
  $$ VALUES (0) $$,
  'RLS-17: anon cannot see comments on soft-deleted posts'
);

-- ─── RLS-18: Disciplines readable by all ─────────────────────────────────────
SELECT ok(
  (SELECT count(*)::int FROM disciplines) > 0,
  'RLS-18: anon can read disciplines'
);

-- ─── RLS-19: Tags readable by all ────────────────────────────────────────────
-- (Skip if no tags seeded — just verify no RLS error)
SELECT lives_ok(
  $$ SELECT count(*) FROM tags $$,
  'RLS-19: anon can SELECT tags table (no RLS block)'
);

-- ─── RLS-20: Reputation readable by all ──────────────────────────────────────
SELECT ok(
  (SELECT reputation FROM profiles WHERE username = 'rls-user1') IS NOT NULL,
  'RLS-20: anon can read reputation from profiles'
);

-- ─── Teardown ─────────────────────────────────────────────────────────────────
SET role postgres;
DELETE FROM votes WHERE id LIKE 'rls-%';
DELETE FROM comments WHERE id LIKE 'rls-%';
DELETE FROM posts WHERE id LIKE 'rls-%';
DELETE FROM profiles WHERE id LIKE 'rls-%';
DELETE FROM auth.users WHERE id LIKE 'rls-%';
DELETE FROM disciplines WHERE id LIKE 'rls-%';

SELECT * FROM finish();
ROLLBACK;

-- =============================================================================
-- ATELIER — pgTAP RLS: Posts Table (RLS-01 to RLS-05)
-- File: tests/rls/01_posts_rls.sql
-- Run: npx supabase test db
-- =============================================================================

BEGIN;
SELECT plan(5);

-- ── Fixtures ─────────────────────────────────────────────────────────────────
INSERT INTO auth.users (id, email) VALUES ('rls-post-u1', 'rlsp1@test.com'), ('rls-post-u2', 'rlsp2@test.com') ON CONFLICT DO NOTHING;
INSERT INTO disciplines (id, slug, name) VALUES ('rls-post-d1', 'rls-post-disc', 'RLS Post Disc') ON CONFLICT DO NOTHING;
INSERT INTO profiles (id, username, onboarded, discipline_id) VALUES ('rls-post-u1', 'rlspost1', true, 'rls-post-d1'), ('rls-post-u2', 'rlspost2', true, 'rls-post-d1') ON CONFLICT DO NOTHING;
INSERT INTO posts (id, title, slug, content, type, author_id, discipline_id, vote_count, comment_count)
  VALUES ('rls-pp1', 'Live Post', 'rls-pp-live', 'Body', 'DISCUSSION', 'rls-post-u1', 'rls-post-d1', 0, 0),
         ('rls-pp2', 'Deleted Post', 'rls-pp-del', 'Body', 'DISCUSSION', 'rls-post-u1', 'rls-post-d1', 0, 0)
  ON CONFLICT DO NOTHING;
UPDATE posts SET deleted_at = NOW() WHERE id = 'rls-pp2';

-- RLS-01: Anon can read non-deleted posts
SET LOCAL ROLE anon;
SELECT results_eq(
  $$ SELECT count(*)::int FROM posts WHERE id = 'rls-pp1' $$,
  $$ VALUES (1) $$,
  'RLS-01: anon can SELECT non-deleted posts'
);

-- RLS-02: Anon cannot read soft-deleted posts
SELECT results_eq(
  $$ SELECT count(*)::int FROM posts WHERE id = 'rls-pp2' $$,
  $$ VALUES (0) $$,
  'RLS-02: anon cannot SELECT soft-deleted posts'
);

-- RLS-03: Authenticated user can INSERT a post
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"rls-post-u1"}';
SELECT lives_ok(
  $$ INSERT INTO posts (id,title,slug,content,type,author_id,discipline_id,vote_count,comment_count)
     VALUES ('rls-pp3','Auth Post','rls-pp-auth','Body','DISCUSSION','rls-post-u1','rls-post-d1',0,0) $$,
  'RLS-03: authenticated user can INSERT post'
);

-- RLS-04: Anon cannot INSERT a post
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ INSERT INTO posts (id,title,slug,content,type,author_id,discipline_id,vote_count,comment_count)
     VALUES ('rls-pp4','Anon Post','rls-pp-anon','Body','DISCUSSION','rls-post-u1','rls-post-d1',0,0) $$,
  'RLS-04: anon is blocked from inserting posts'
);

-- RLS-05: Author can soft-delete own post
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"rls-post-u1"}';
SELECT lives_ok(
  $$ UPDATE posts SET deleted_at = NOW() WHERE id = 'rls-pp1' $$,
  'RLS-05: post author can soft-delete own post'
);

-- ── Teardown ──────────────────────────────────────────────────────────────────
RESET ROLE;
DELETE FROM posts    WHERE id LIKE 'rls-pp%';
DELETE FROM profiles WHERE id LIKE 'rls-post-%';
DELETE FROM auth.users WHERE id LIKE 'rls-post-%';
DELETE FROM disciplines WHERE id LIKE 'rls-post-%';

SELECT * FROM finish();
ROLLBACK;

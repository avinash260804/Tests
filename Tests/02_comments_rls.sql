-- =============================================================================
-- ATELIER — pgTAP RLS: Comments Table (RLS-06 to RLS-09)
-- File: tests/rls/02_comments_rls.sql
-- Run: npx supabase test db
-- =============================================================================

BEGIN;
SELECT plan(4);

-- ── Fixtures ─────────────────────────────────────────────────────────────────
INSERT INTO auth.users (id, email) VALUES ('rls-cm-u1','rlscm1@t.com'),('rls-cm-u2','rlscm2@t.com') ON CONFLICT DO NOTHING;
INSERT INTO disciplines (id,slug,name) VALUES ('rls-cm-d1','rls-cm-disc','RLS Cm Disc') ON CONFLICT DO NOTHING;
INSERT INTO profiles (id,username,onboarded,discipline_id)
  VALUES ('rls-cm-u1','rlscm1',true,'rls-cm-d1'),('rls-cm-u2','rlscm2',true,'rls-cm-d1') ON CONFLICT DO NOTHING;
INSERT INTO posts (id,title,slug,content,type,author_id,discipline_id,vote_count,comment_count)
  VALUES ('rls-cm-p1','CM Post','rls-cm-post','Body','DISCUSSION','rls-cm-u1','rls-cm-d1',0,0) ON CONFLICT DO NOTHING;
INSERT INTO comments (id,content,post_id,author_id,vote_count)
  VALUES ('rls-c-live','Live comment','rls-cm-p1','rls-cm-u2',0),
         ('rls-c-del', 'Deleted comment','rls-cm-p1','rls-cm-u2',0) ON CONFLICT DO NOTHING;
UPDATE comments SET deleted_at = NOW() WHERE id = 'rls-c-del';

-- RLS-06: Anon can read non-deleted comments
SET LOCAL ROLE anon;
SELECT results_eq(
  $$ SELECT count(*)::int FROM comments WHERE id = 'rls-c-live' $$,
  $$ VALUES (1) $$,
  'RLS-06: anon can read non-deleted comments'
);

-- RLS-07: Anon cannot read soft-deleted comments
SELECT results_eq(
  $$ SELECT count(*)::int FROM comments WHERE id = 'rls-c-del' $$,
  $$ VALUES (0) $$,
  'RLS-07: anon cannot read soft-deleted comments'
);

-- RLS-08: Authenticated onboarded user can INSERT comment
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"rls-cm-u2"}';
SELECT lives_ok(
  $$ INSERT INTO comments (id,content,post_id,author_id,vote_count)
     VALUES ('rls-c-new','Auth comment','rls-cm-p1','rls-cm-u2',0) $$,
  'RLS-08: authenticated user can INSERT comment'
);

-- RLS-09: Anon cannot INSERT comment
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ INSERT INTO comments (id,content,post_id,author_id,vote_count)
     VALUES ('rls-c-anon','Anon comment','rls-cm-p1','rls-cm-u1',0) $$,
  'RLS-09: anon is blocked from inserting comments'
);

-- ── Teardown ──────────────────────────────────────────────────────────────────
RESET ROLE;
DELETE FROM comments    WHERE id LIKE 'rls-c%';
DELETE FROM posts       WHERE id LIKE 'rls-cm-%';
DELETE FROM profiles    WHERE id LIKE 'rls-cm-%';
DELETE FROM auth.users  WHERE id LIKE 'rls-cm-%';
DELETE FROM disciplines WHERE id LIKE 'rls-cm-%';

SELECT * FROM finish();
ROLLBACK;

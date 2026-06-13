-- =============================================================================
-- ATELIER — pgTAP RLS: Votes Table (RLS-10 to RLS-12)
-- File: tests/rls/03_votes_rls.sql
-- Run: npx supabase test db
-- =============================================================================

BEGIN;
SELECT plan(3);

-- ── Fixtures ─────────────────────────────────────────────────────────────────
INSERT INTO auth.users (id,email) VALUES ('rls-vt-u1','rlsvt1@t.com'),('rls-vt-u2','rlsvt2@t.com') ON CONFLICT DO NOTHING;
INSERT INTO disciplines (id,slug,name) VALUES ('rls-vt-d1','rls-vt-disc','RLS Vt Disc') ON CONFLICT DO NOTHING;
INSERT INTO profiles (id,username,onboarded,discipline_id)
  VALUES ('rls-vt-u1','rlsvt1',true,'rls-vt-d1'),('rls-vt-u2','rlsvt2',true,'rls-vt-d1') ON CONFLICT DO NOTHING;
INSERT INTO posts (id,title,slug,content,type,author_id,discipline_id,vote_count,comment_count)
  VALUES ('rls-vt-p1','Vt Post','rls-vt-post','Body','DISCUSSION','rls-vt-u1','rls-vt-d1',0,0) ON CONFLICT DO NOTHING;
INSERT INTO votes (id,author_id,post_id,direction)
  VALUES ('rls-v-seed','rls-vt-u1','rls-vt-p1','UP') ON CONFLICT DO NOTHING;

-- RLS-10: Any authenticated user can SELECT votes
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"rls-vt-u2"}';
SELECT results_eq(
  $$ SELECT count(*)::int FROM votes WHERE id = 'rls-v-seed' $$,
  $$ VALUES (1) $$,
  'RLS-10: authenticated user can read votes'
);

-- RLS-11: Authenticated user can INSERT vote as themselves
SELECT lives_ok(
  $$ INSERT INTO votes (id,author_id,post_id,direction)
     VALUES ('rls-v-own','rls-vt-u2','rls-vt-p1','UP') ON CONFLICT DO NOTHING $$,
  'RLS-11: user can INSERT vote as themselves'
);

-- RLS-12: User cannot INSERT vote impersonating another user
SELECT throws_ok(
  $$ INSERT INTO votes (id,author_id,post_id,direction)
     VALUES ('rls-v-fake','rls-vt-u1','rls-vt-p1','DOWN') $$,
  'RLS-12: user cannot INSERT vote as a different user'
);

-- ── Teardown ──────────────────────────────────────────────────────────────────
RESET ROLE;
DELETE FROM votes       WHERE id LIKE 'rls-v%';
DELETE FROM posts       WHERE id LIKE 'rls-vt-%';
DELETE FROM profiles    WHERE id LIKE 'rls-vt-%';
DELETE FROM auth.users  WHERE id LIKE 'rls-vt-%';
DELETE FROM disciplines WHERE id LIKE 'rls-vt-%';

SELECT * FROM finish();
ROLLBACK;

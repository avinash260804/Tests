-- =============================================================================
-- ATELIER — pgTAP RLS: Cross-Table Tests (RLS-17 to RLS-20)
-- File: tests/rls/05_cross_table_rls.sql
-- Run: npx supabase test db
-- =============================================================================

BEGIN;
SELECT plan(4);

-- ── Fixtures ─────────────────────────────────────────────────────────────────
INSERT INTO auth.users (id,email) VALUES ('rls-xt-u1','rlsxt1@t.com') ON CONFLICT DO NOTHING;
INSERT INTO disciplines (id,slug,name) VALUES ('rls-xt-d1','rls-xt-disc','RLS XT Disc') ON CONFLICT DO NOTHING;
INSERT INTO profiles (id,username,onboarded,discipline_id,reputation)
  VALUES ('rls-xt-u1','rlsxt1',true,'rls-xt-d1',77) ON CONFLICT DO NOTHING;
-- Soft-deleted post with a comment
INSERT INTO posts (id,title,slug,content,type,author_id,discipline_id,vote_count,comment_count)
  VALUES ('rls-xt-p1','Deleted','rls-xt-del','Body','DISCUSSION','rls-xt-u1','rls-xt-d1',0,1) ON CONFLICT DO NOTHING;
UPDATE posts SET deleted_at = NOW() WHERE id = 'rls-xt-p1';
INSERT INTO comments (id,content,post_id,author_id,vote_count)
  VALUES ('rls-xt-c1','Comment on deleted post','rls-xt-p1','rls-xt-u1',0) ON CONFLICT DO NOTHING;

-- RLS-17: Anon cannot see comments on soft-deleted posts
SET LOCAL ROLE anon;
SELECT results_eq(
  $$ SELECT count(*)::int FROM comments c
     JOIN posts p ON c.post_id = p.id
     WHERE p.deleted_at IS NOT NULL $$,
  $$ VALUES (0) $$,
  'RLS-17: anon sees zero comments on soft-deleted posts'
);

-- RLS-18: Disciplines readable by all (anon)
SELECT ok(
  (SELECT count(*)::int FROM disciplines) > 0,
  'RLS-18: anon can read disciplines table'
);

-- RLS-19: Tags readable by all (no RLS block)
SELECT lives_ok(
  $$ SELECT count(*) FROM tags $$,
  'RLS-19: anon can SELECT tags without error'
);

-- RLS-20: Reputation column readable by all
SELECT ok(
  (SELECT reputation FROM profiles WHERE username = 'rlsxt1') = 77,
  'RLS-20: anon can read reputation from profiles'
);

-- ── Teardown ──────────────────────────────────────────────────────────────────
RESET ROLE;
DELETE FROM comments    WHERE id LIKE 'rls-xt-%';
DELETE FROM posts       WHERE id LIKE 'rls-xt-%';
DELETE FROM profiles    WHERE id LIKE 'rls-xt-%';
DELETE FROM auth.users  WHERE id LIKE 'rls-xt-%';
DELETE FROM disciplines WHERE id LIKE 'rls-xt-%';

SELECT * FROM finish();
ROLLBACK;

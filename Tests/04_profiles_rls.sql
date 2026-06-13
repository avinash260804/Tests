-- =============================================================================
-- ATELIER — pgTAP RLS: Profiles Table (RLS-13 to RLS-16)
-- File: tests/rls/04_profiles_rls.sql
-- Run: npx supabase test db
-- =============================================================================

BEGIN;
SELECT plan(4);

-- ── Fixtures ─────────────────────────────────────────────────────────────────
INSERT INTO auth.users (id,email) VALUES ('rls-pr-u1','rlspr1@t.com'),('rls-pr-u2','rlspr2@t.com') ON CONFLICT DO NOTHING;
INSERT INTO disciplines (id,slug,name) VALUES ('rls-pr-d1','rls-pr-disc','RLS Pr Disc') ON CONFLICT DO NOTHING;
INSERT INTO profiles (id,username,onboarded,discipline_id)
  VALUES ('rls-pr-u1','rlspr1',true,'rls-pr-d1'),('rls-pr-u2','rlspr2',true,'rls-pr-d1') ON CONFLICT DO NOTHING;

-- RLS-13: Anon can read any public profile
SET LOCAL ROLE anon;
SELECT results_eq(
  $$ SELECT count(*)::int FROM profiles WHERE username = 'rlspr1' $$,
  $$ VALUES (1) $$,
  'RLS-13: anon can read any public profile'
);

-- RLS-14: User can UPDATE their own profile
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"rls-pr-u1"}';
SELECT lives_ok(
  $$ UPDATE profiles SET bio = 'My new bio' WHERE id = 'rls-pr-u1' $$,
  'RLS-14: user can update their own profile'
);

-- RLS-15: User cannot UPDATE another user's profile
SELECT results_eq(
  $$ UPDATE profiles SET bio = 'Hacked' WHERE id = 'rls-pr-u2' RETURNING id $$,
  $$ VALUES (NULL::text) $$,
  'RLS-15: user cannot update another user profile (0 rows affected)'
);

-- RLS-16: User cannot INSERT profile row for a different userId
SELECT throws_ok(
  $$ INSERT INTO profiles (id,username,onboarded,discipline_id)
     VALUES ('rls-pr-u2-dup','hacker',true,'rls-pr-d1') $$,
  'RLS-16: user cannot INSERT profile row for another userId'
);

-- ── Teardown ──────────────────────────────────────────────────────────────────
RESET ROLE;
DELETE FROM profiles    WHERE id LIKE 'rls-pr-%';
DELETE FROM auth.users  WHERE id LIKE 'rls-pr-%';
DELETE FROM disciplines WHERE id LIKE 'rls-pr-%';

SELECT * FROM finish();
ROLLBACK;

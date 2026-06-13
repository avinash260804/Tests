-- =============================================================================
-- ATELIER — pgTAP Schema Tests (SCH-09, SCH-10)
-- File: tests/rls/schema.test.sql
-- Run: npx supabase test db
-- =============================================================================

BEGIN;

SELECT plan(8);

-- SCH-09: posts table exists with required columns
SELECT has_table('public', 'posts', 'posts table should exist');

SELECT has_column('public', 'posts', 'id',         'posts.id column exists');
SELECT has_column('public', 'posts', 'title',      'posts.title column exists');
SELECT has_column('public', 'posts', 'slug',       'posts.slug column exists');
SELECT has_column('public', 'posts', 'deleted_at', 'posts.deleted_at column exists (soft delete)');

-- SCH-10: votes table has correct unique constraints
SELECT has_table('public', 'votes', 'votes table should exist');

SELECT has_index(
  'public',
  'votes',
  'votes_author_id_post_id_key',
  'votes unique index on (author_id, post_id) exists'
);

SELECT has_index(
  'public',
  'votes',
  'votes_author_id_comment_id_key',
  'votes unique index on (author_id, comment_id) exists'
);

SELECT * FROM finish();

ROLLBACK;

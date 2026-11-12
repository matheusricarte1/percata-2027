-- =====================================================================
-- pgTAP: RLS de dfd_drafts (migration 0042) — owner-only de verdade.
-- =====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(5);

SELECT has_table('public', 'dfd_drafts', 'dfd_drafts existe');

SELECT ok(
  (SELECT relrowsecurity FROM pg_class
    WHERE relname = 'dfd_drafts' AND relnamespace = 'public'::regnamespace),
  'RLS habilitada em dfd_drafts');

SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class
    WHERE relname = 'dfd_drafts' AND relnamespace = 'public'::regnamespace),
  'RLS FORÇADA em dfd_drafts');

-- 4 policies: select_own, insert_own, update_own, delete_own
SELECT is(
  (SELECT count(*)::int FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dfd_drafts'),
  4,
  '4 policies registradas em dfd_drafts');

-- Trigger de updated_at + renovação de TTL
SELECT has_trigger('public', 'dfd_drafts', 'trg_dfd_drafts_updated_at',
  'trigger trg_dfd_drafts_updated_at existe');

SELECT * FROM finish();

ROLLBACK;

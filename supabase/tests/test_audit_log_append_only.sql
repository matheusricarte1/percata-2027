-- =====================================================================
-- pgTAP: prova que audit_log (migration 0039) é append-only de verdade.
--
-- Sem este teste, um futuro patch (ex.: alguém adicionando policy
-- "permissive UPDATE" por engano) passaria despercebido e a auditoria
-- silenciosamente viraria mutável — colapsando defesa em processo
-- administrativo (Lei 14.133/2021).
--
-- Rodar:
--   psql $DATABASE_URL -f supabase-migrations/tests/test_audit_log_append_only.sql
--
-- Requer extensão pgtap. Em Supabase:
--   CREATE EXTENSION IF NOT EXISTS pgtap;
-- =====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(11);

-- ------------------------------------------------------------------
-- Estrutura
-- ------------------------------------------------------------------
SELECT has_table('public', 'audit_log',
  'audit_log existe (migration 0039)');

SELECT has_column('public', 'audit_log', 'row_hash',
  'tem row_hash para detecção de adulteração');

SELECT has_column('public', 'audit_log', 'prev_hash',
  'tem prev_hash para encadeamento');

-- ------------------------------------------------------------------
-- RLS habilitada e forçada
-- ------------------------------------------------------------------
SELECT ok(
  (SELECT relrowsecurity FROM pg_class
    WHERE relname = 'audit_log' AND relnamespace = 'public'::regnamespace),
  'RLS habilitada em audit_log');

SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class
    WHERE relname = 'audit_log' AND relnamespace = 'public'::regnamespace),
  'RLS FORÇADA (aplica até para owner)');

-- ------------------------------------------------------------------
-- Triggers de bloqueio existem
-- ------------------------------------------------------------------
SELECT has_trigger('public', 'audit_log', 'trg_audit_log_no_update',
  'trigger BEFORE UPDATE existe');

SELECT has_trigger('public', 'audit_log', 'trg_audit_log_no_delete',
  'trigger BEFORE DELETE existe');

SELECT has_trigger('public', 'audit_log', 'trg_audit_log_no_truncate',
  'trigger BEFORE TRUNCATE existe');

-- ------------------------------------------------------------------
-- Tentativas reais de mutação devem falhar.
-- Inserimos uma linha (como superuser nos testes), depois tentamos
-- UPDATE/DELETE/TRUNCATE e esperamos exceção.
-- ------------------------------------------------------------------
INSERT INTO audit_log
  (table_name, row_id, action, new_data, row_hash)
VALUES
  ('__pgtap_test', 'r1', 'INSERT', '{"v":1}'::jsonb, 'h0');

SELECT throws_ok(
  $$UPDATE audit_log SET action = 'TAMPER' WHERE table_name = '__pgtap_test'$$,
  NULL,                                 -- qualquer SQLSTATE
  NULL,                                 -- qualquer MESSAGE
  'UPDATE em audit_log levanta exceção');

SELECT throws_ok(
  $$DELETE FROM audit_log WHERE table_name = '__pgtap_test'$$,
  NULL, NULL,
  'DELETE em audit_log levanta exceção');

SELECT throws_ok(
  $$TRUNCATE audit_log$$,
  NULL, NULL,
  'TRUNCATE em audit_log levanta exceção');

-- ------------------------------------------------------------------
-- Cleanup: como não conseguimos DELETE direto, abortamos a transação.
-- ------------------------------------------------------------------
SELECT * FROM finish();

ROLLBACK;

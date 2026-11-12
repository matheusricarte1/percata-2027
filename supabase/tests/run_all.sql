-- Wrapper que executa todos os testes pgTAP do PERCATA em sequência.
-- Cada teste roda em sua própria transação (BEGIN/ROLLBACK interno).
--
-- Uso:
--   psql "$DATABASE_URL" -f supabase/tests/run_all.sql
-- ou:
--   npm run test:db

\set ON_ERROR_STOP on

\echo '--- test_audit_log_append_only ---'
\ir test_audit_log_append_only.sql

\echo '--- test_create_dfd_with_items ---'
\ir test_create_dfd_with_items.sql

\echo '--- test_superadmin_table ---'
\ir test_superadmin_table.sql

\echo '--- test_dfd_drafts_rls ---'
\ir test_dfd_drafts_rls.sql

\echo '--- All pgTAP tests finished ---'

-- =====================================================================
-- pgTAP: app_is_superadmin() consulta tabela, não email hardcoded
-- (migration 0041).
-- =====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(6);

SELECT has_table('public', 'system_superadmins',
  'system_superadmins existe');

SELECT has_function('public', 'app_is_superadmin', ARRAY[]::text[],
  'app_is_superadmin() existe');

-- Bootstrap deveria ter inserido matheus.ricarte@upe.br.
SELECT ok(
  EXISTS (
    SELECT 1 FROM system_superadmins
    WHERE email = 'matheus.ricarte@upe.br' AND active
  ),
  'Bootstrap inseriu superadmin original');

-- Simula JWT do superadmin.
SET LOCAL request.jwt.claim.email = 'matheus.ricarte@upe.br';
SELECT ok(app_is_superadmin(),
  'app_is_superadmin() retorna true para email cadastrado');

-- Simula outro email — não deveria ser superadmin.
SET LOCAL request.jwt.claim.email = 'outro@upe.br';
SELECT ok(NOT app_is_superadmin(),
  'app_is_superadmin() retorna false para email NÃO cadastrado');

-- Policy de governanca_ciclos passou a usar a função (não literal).
-- Cheque indireto: a policy USE EXISTS deveria estar usando app_is_superadmin().
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'governanca_ciclos'
      AND policyname = 'governanca_ciclos_update_superadmin'
      AND (qual ILIKE '%app_is_superadmin%'
           OR with_check ILIKE '%app_is_superadmin%')
  ),
  'Policy governanca_ciclos_update_superadmin chama app_is_superadmin()');

SELECT * FROM finish();

ROLLBACK;

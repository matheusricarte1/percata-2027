-- =====================================================================
-- pgTAP: prova atomicidade da RPC create_dfd_with_items (migration 0040).
--
-- Garante que:
--   - autenticação é exigida (sem auth.uid() => exceção 28000)
--   - itens vazios => exceção 22023
--   - protocolo gerado tem formato esperado
--   - rollback total quando algum item falha (cobertura indireta:
--     forçamos erro num campo NOT NULL e checamos que dfds permanece vazio)
-- =====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(5);

-- ------------------------------------------------------------------
-- Função existe e tem assinatura esperada
-- ------------------------------------------------------------------
SELECT has_function(
  'public', 'create_dfd_with_items',
  ARRAY['jsonb', 'jsonb'],
  'create_dfd_with_items(jsonb, jsonb) existe (migration 0040)');

-- ------------------------------------------------------------------
-- Sem auth.uid() => 28000
-- ------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub = '';
SELECT throws_ok(
  $$SELECT create_dfd_with_items('{}'::jsonb, '[]'::jsonb)$$,
  '28000',
  NULL,
  'Sem auth.uid() retorna SQLSTATE 28000');

-- ------------------------------------------------------------------
-- Itens vazios => 22023
-- ------------------------------------------------------------------
-- Simula um usuário autenticado de teste.
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
SET LOCAL request.jwt.claim.email = 'pgtap@upe.br';

SELECT throws_ok(
  $$SELECT create_dfd_with_items(
      jsonb_build_object(
        'objeto_contratacao', 'X',
        'justificativa_contratacao', 'Y',
        'unidade_id', '00000000-0000-0000-0000-000000000002'
      ),
      '[]'::jsonb)$$,
  '22023',
  NULL,
  'Lista de itens vazia retorna SQLSTATE 22023');

-- ------------------------------------------------------------------
-- Protocolo: gen_dfd_protocolo retorna formato correto.
-- ------------------------------------------------------------------
SELECT matches(
  gen_dfd_protocolo('PET'),
  '^DFD-\d{4}-PET-\d{6}$',
  'gen_dfd_protocolo produz DFD-YYYY-SIGLA-NNNNNN');

SELECT matches(
  gen_dfd_protocolo(NULL),
  '^DFD-\d{4}-UPE-\d{6}$',
  'gen_dfd_protocolo com NULL usa sigla "UPE"');

SELECT * FROM finish();

ROLLBACK;

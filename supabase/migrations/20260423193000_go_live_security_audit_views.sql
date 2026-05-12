-- Go-live security audit helpers (read-only views)
-- Purpose: give admin/superadmin a quick SQL checklist for RLS + policy coverage.

drop view if exists public.security_role_policy_matrix;
drop view if exists public.security_rls_pending_tables;
drop view if exists public.security_rls_status;

create view public.security_rls_status as
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  coalesce(p.policy_count, 0) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join (
  select schemaname, tablename, count(*)::int as policy_count
  from pg_policies
  group by schemaname, tablename
) p
  on p.schemaname = n.nspname
 and p.tablename = c.relname
where c.relkind = 'r'
  and n.nspname = 'public'
order by c.relname;

create view public.security_rls_pending_tables as
select
  schema_name,
  table_name,
  rls_enabled,
  rls_forced,
  policy_count,
  case
    when not rls_enabled then 'RLS_DESABILITADO'
    when policy_count = 0 then 'SEM_POLITICAS'
    else 'OK'
  end as coverage_status
from public.security_rls_status
where (not rls_enabled) or policy_count = 0
order by table_name;

create view public.security_role_policy_matrix as
select
  schemaname as schema_name,
  tablename as table_name,
  policyname as policy_name,
  cmd as command,
  permissive as policy_mode,
  roles
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

comment on view public.security_rls_status is
  'Cobertura RLS por tabela public: habilitado/forçado e quantidade de políticas.';
comment on view public.security_rls_pending_tables is
  'Tabelas com pendência de segurança: RLS desabilitado ou sem políticas.';
comment on view public.security_role_policy_matrix is
  'Matriz de políticas por comando e roles para auditoria de permissões.';


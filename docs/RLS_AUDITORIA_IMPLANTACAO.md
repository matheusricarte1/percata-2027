# RLS e Politicas — Auditoria de Implantacao

## Objetivo
Garantir que todas as tabelas `public` estejam com RLS ativo e politicas aplicadas antes do go-live.

## Migration aplicada
- `supabase/migrations/20260423193000_go_live_security_audit_views.sql`

## Consultas operacionais (SQL Editor)

```sql
select * from public.security_rls_pending_tables;
```

```sql
select * from public.security_rls_status order by table_name;
```

```sql
select * from public.security_role_policy_matrix order by table_name, command, policy_name;
```

## Criterio de aceite
- `security_rls_pending_tables` deve retornar **0 linhas**.
- Todas as tabelas sensiveis devem possuir politicas por papel/campus.

## Checklist minimo por modulo
- `dfds` e `dfd_items`: isolamento por campus + ownership do solicitante + visao de chefia por unidade.
- `notifications`: leitura apenas do proprio usuario (exceto admin/superadmin).
- `profiles` e `user_units`: escrita restrita para fluxos administrativos.
- `kits`, `campaigns`, `exports`: leitura/escrita por papel administrativo.

## Observacao
Estas views sao de auditoria (somente leitura). Nao alteram dados de negocio.

alter table public.dfd_collective_contributions
  add column if not exists justificativa_quantidade text;

alter table public.dfd_collective_contributions
  add column if not exists unidade_medida text not null default 'UN';

alter table public.dfd_items
  add column if not exists unidade_medida text not null default 'UN';

update public.dfd_collective_contributions
set unidade_medida = upper(trim(coalesce(unidade_medida, 'UN')))
where unidade_medida is null or trim(unidade_medida) = '';

update public.dfd_items
set unidade_medida = upper(trim(coalesce(unidade_medida, 'UN')))
where unidade_medida is null or trim(unidade_medida) = '';

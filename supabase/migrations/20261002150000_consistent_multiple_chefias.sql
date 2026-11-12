-- Keep unit-level chefia assignments and the general evaluation access coherent.
-- Membership RLS already restricts assigning chefia to administrators.
create or replace function private.sync_chefia_profile_role()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  promoted public.profiles%rowtype;
  actor public.profiles%rowtype;
  profile_role text;
begin
  if new.role_in_unit = 'chefia' then
    select role into profile_role from public.profiles where id = new.user_id for update;
    if profile_role = 'admin' then
      raise exception 'O perfil Admin não possui acesso à avaliação. Revise o perfil antes de atribuir chefia.'
        using errcode = '23514';
    end if;
    update public.profiles set role = 'chefia'
      where id = new.user_id and role = 'solicitante'
      returning * into promoted;
    if found then
      select * into actor from public.profiles where id = auth.uid();
      insert into public.admin_user_audit_logs
        (actor_user_id, actor_email, actor_role, target_profile_id, target_email, action, details)
      values (actor.id, coalesce(actor.email, 'system:chefia-membership-sync'),
        coalesce(actor.role, 'system'), promoted.id, promoted.email, 'update_role',
        jsonb_build_object('source', 'chefia_membership_sync', 'previous_role', 'solicitante',
          'next_role', 'chefia', 'unit_type', new.unit_type, 'unit_id', new.unit_id));
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.sync_chefia_profile_role() from public, anon, authenticated;
drop trigger if exists sync_chefia_profile_role on public.user_units;
create trigger sync_chefia_profile_role after insert or update of role_in_unit, user_id
  on public.user_units for each row execute function private.sync_chefia_profile_role();

create or replace function private.prevent_chefia_profile_downgrade()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role in ('solicitante', 'admin') and old.role is distinct from new.role
    and exists (select 1 from public.user_units where user_id = new.id and role_in_unit = 'chefia') then
    raise exception 'Remova os papéis de chefia dos setores e laboratórios antes de alterar o perfil para Solicitante ou Admin.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.prevent_chefia_profile_downgrade() from public, anon, authenticated;
drop trigger if exists prevent_chefia_profile_downgrade on public.profiles;
create trigger prevent_chefia_profile_downgrade before update of role on public.profiles
  for each row execute function private.prevent_chefia_profile_downgrade();

-- Change one person's assignment atomically, preserving every other chefia and
-- retaining their membership when the chefia responsibility is removed.
create or replace function public.manage_unit_chefia(
  p_actor uuid, p_unit_type text, p_unit_id uuid, p_user_id uuid, p_remove boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor public.profiles%rowtype;
  target public.profiles%rowtype;
  unit_campus uuid;
  unit_active boolean;
  previous_unit_role text;
begin
  select * into actor from public.profiles where id = p_actor;
  if actor.id is null or actor.role <> 'superadmin' or actor.is_active is not true then
    raise exception 'Somente superadmin ativo pode gerenciar chefias.' using errcode = '42501';
  end if;
  if p_unit_type = 'departamento' then
    select campus_id, ativo into unit_campus, unit_active from public.departamentos
      where id = p_unit_id for update;
  elsif p_unit_type = 'laboratorio' then
    select campus_id, ativo into unit_campus, unit_active from public.laboratorios
      where id = p_unit_id for update;
  else
    raise exception 'Tipo de unidade inválido.' using errcode = '22023';
  end if;
  if not found then raise exception 'Unidade não encontrada.' using errcode = 'P0002'; end if;
  if p_remove is not true and unit_active is not true then
    raise exception 'Não é possível atribuir chefia a uma unidade inativa.' using errcode = '23514';
  end if;
  select * into target from public.profiles where id = p_user_id for update;
  if not found then raise exception 'Usuário não encontrado.' using errcode = 'P0002'; end if;
  if p_remove is not true then
    if target.is_active is not true then
      raise exception 'A conta selecionada está inativa.' using errcode = '23514';
    end if;
    if target.campus_id is distinct from unit_campus or unit_campus is null then
      raise exception 'A chefia precisa pertencer ao mesmo campus da unidade.' using errcode = '23514';
    end if;
    if target.role = 'admin' then
      raise exception 'O perfil Admin não possui acesso à avaliação. Revise o perfil antes de atribuir chefia.'
        using errcode = '23514';
    end if;
  end if;
  select role_in_unit into previous_unit_role from public.user_units
    where user_id = p_user_id and unit_type = p_unit_type and unit_id = p_unit_id;
  if p_remove is true then
    update public.user_units set role_in_unit = 'membro'
      where user_id = p_user_id and unit_type = p_unit_type and unit_id = p_unit_id
        and role_in_unit = 'chefia';
  else
    insert into public.user_units(user_id, unit_type, unit_id, role_in_unit)
      values(p_user_id, p_unit_type, p_unit_id, 'chefia')
      on conflict(user_id, unit_type, unit_id) do update set role_in_unit = 'chefia';
  end if;
  insert into public.admin_user_audit_logs
    (actor_user_id, actor_email, actor_role, target_profile_id, target_email, action, details)
  values(actor.id, actor.email, actor.role, target.id, target.email, 'update_profile',
    jsonb_build_object('source', 'manage_unit_chefia', 'unit_type', p_unit_type,
      'unit_id', p_unit_id, 'previous_role_in_unit', previous_unit_role,
      'next_role_in_unit', case when p_remove is true then 'membro' else 'chefia' end));
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.manage_unit_chefia(uuid, text, uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.manage_unit_chefia(uuid, text, uuid, uuid, boolean) to service_role;
notify pgrst, 'reload schema';

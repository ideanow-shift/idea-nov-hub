-- PR002 / M013 corrective / M062
-- Include NEW in the effective-dated hierarchy graph and serialize hierarchy writes.

create function accounting.account_hierarchy_cycle_exists(
  p_account_version_id uuid,
  p_account_id uuid,
  p_parent_account_id uuid,
  p_effective_period daterange
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  with recursive edges(account_id, parent_account_id, effective_period) as (
    select a.account_id, a.parent_account_id, a.effective_period
    from accounting.accounts a
    where a.parent_account_id is not null
      and a.account_version_id <> p_account_version_id
    union all
    select p_account_id, p_parent_account_id, p_effective_period
    where p_parent_account_id is not null
  ), walk(node_id, common_period, path, cycle) as (
    select p_parent_account_id, p_effective_period,
      array[p_account_id, p_parent_account_id]::uuid[],
      p_parent_account_id = p_account_id
    where p_parent_account_id is not null
    union all
    select e.parent_account_id, w.common_period * e.effective_period,
      w.path || e.parent_account_id,
      e.parent_account_id = any(w.path)
    from walk w
    join edges e on e.account_id = w.node_id
    where not w.cycle
      and e.parent_account_id is not null
      and e.effective_period && w.common_period
  )
  select coalesce(bool_or(cycle), false) from walk
$function$;

create or replace function accounting.validate_account_version_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  new_period daterange := pg_catalog.daterange(new.effective_from, new.effective_to, '[)');
begin
  -- One global, transaction-scoped hierarchy lock. Account Master writes are low-volume.
  perform pg_catalog.pg_advisory_xact_lock(13013, 62);

  if new.parent_account_id is not null then
    if new.parent_account_id = new.account_id then
      raise exception 'BDF_ACCOUNT_HIERARCHY_CYCLE';
    end if;
    if not exists (
      select 1 from accounting.accounts parent
      where parent.account_id = new.parent_account_id
        and parent.statement_type = new.statement_type
        and parent.effective_period @> new_period
    ) then
      raise exception 'BDF_ACCOUNT_PARENT_VERSION_NOT_COMPATIBLE';
    end if;

    if accounting.account_hierarchy_cycle_exists(
      new.account_version_id, new.account_id, new.parent_account_id, new_period
    ) then
      raise exception 'BDF_ACCOUNT_HIERARCHY_CYCLE';
    end if;
  end if;
  return new;
end
$function$;

create function accounting.revalidate_account_hierarchy_deferred()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  perform pg_catalog.pg_advisory_xact_lock(13013, 62);
  if accounting.account_hierarchy_cycle_exists(
    new.account_version_id, new.account_id, new.parent_account_id, new.effective_period
  ) then
    raise exception 'BDF_ACCOUNT_HIERARCHY_CYCLE';
  end if;
  return new;
end
$function$;

create constraint trigger revalidate_account_hierarchy_deferred
after insert on accounting.accounts
deferrable initially deferred
for each row execute function accounting.revalidate_account_hierarchy_deferred();

revoke execute on function accounting.account_hierarchy_cycle_exists(uuid, uuid, uuid, daterange)
  from public, anon, authenticated, service_role;
revoke execute on function accounting.revalidate_account_hierarchy_deferred()
  from public, anon, authenticated, service_role;

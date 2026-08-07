-- M062-only rollback. Restore the immutable M013 function contract; preserve all M013 tables.
drop trigger revalidate_account_hierarchy_deferred on accounting.accounts;
drop function accounting.revalidate_account_hierarchy_deferred();
drop function accounting.account_hierarchy_cycle_exists(uuid, uuid, uuid, daterange);

create or replace function accounting.validate_account_version_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare cycle_found boolean;
begin
  if new.parent_account_id is not null then
    if not exists (
      select 1 from accounting.accounts parent
      where parent.account_id = new.parent_account_id
        and parent.statement_type = new.statement_type
        and parent.effective_period @> new.effective_from
        and (new.effective_to is null or parent.effective_to is null or parent.effective_to >= new.effective_to)
    ) then raise exception 'BDF_ACCOUNT_PARENT_VERSION_NOT_COMPATIBLE'; end if;
    with recursive ancestors(account_id, parent_account_id) as (
      select parent.account_id, parent.parent_account_id from accounting.accounts parent
      where parent.account_id = new.parent_account_id and parent.effective_period @> new.effective_from
      union all
      select parent.account_id, parent.parent_account_id from accounting.accounts parent
      join ancestors a on parent.account_id = a.parent_account_id
      where parent.effective_period @> new.effective_from
    )
    select coalesce(bool_or(account_id = new.account_id), false) into cycle_found from ancestors;
    if cycle_found then raise exception 'BDF_ACCOUNT_HIERARCHY_CYCLE'; end if;
  end if;
  return new;
end
$function$;

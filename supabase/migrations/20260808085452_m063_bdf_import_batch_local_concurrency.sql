-- PR002 / M015 corrective / M063
-- Replace global import membership table locks with batch-local row serialization.

create function accounting.guard_import_membership_seal_m063()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  old_batch_id uuid;
  new_batch_id uuid;
  locked_batch record;
  locked_count integer := 0;
  expected_count integer;
begin
  -- UPDATE already owns the target Batch row lock before this BEFORE ROW trigger.
  -- No child-table lock is taken here; M012 performs the immediate lifecycle check.
  if tg_table_name = 'import_batches' then
    return new;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    old_batch_id := old.import_batch_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    new_batch_id := new.import_batch_id;
  end if;

  expected_count := case
    when old_batch_id is not null and new_batch_id is not null and old_batch_id <> new_batch_id then 2
    else 1
  end;

  -- The Batch row is the batch-local mutex. UUID ordering is mandatory when an
  -- UPDATE mentions two batches, so every transaction acquires rows identically.
  for locked_batch in
    select b.import_batch_id, b.status
    from accounting.import_batches b
    where b.import_batch_id = old_batch_id
       or b.import_batch_id = new_batch_id
    order by b.import_batch_id
    for update
  loop
    locked_count := locked_count + 1;
    if locked_batch.status in ('validated', 'rejected', 'promoted', 'superseded') then
      raise exception 'BDF_ACCOUNTING_IMPORT_BATCH_MEMBERSHIP_SEALED';
    end if;
  end loop;

  if locked_count <> expected_count then
    raise exception 'BDF_ACCOUNTING_IMPORT_BATCH_NOT_FOUND';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$function$;

create function accounting.revalidate_import_batch_membership_m063()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  -- A deferred query receives a fresh Read Committed command snapshot after any
  -- Batch-row waiter has resumed. It closes the stale-snapshot window left by an
  -- immediate BEFORE UPDATE check that had to wait for a concurrent child writer.
  if new.status = 'validated' and old.status <> 'validated' and (
    not exists (
      select 1 from accounting.import_files f
      where f.import_batch_id = new.import_batch_id
    )
    or exists (
      select 1 from accounting.import_files f
      where f.import_batch_id = new.import_batch_id
        and f.validation_status <> 'validated'
    )
    or not exists (
      select 1 from accounting.import_staging_lines s
      where s.import_batch_id = new.import_batch_id
    )
    or exists (
      select 1 from accounting.import_staging_lines s
      where s.import_batch_id = new.import_batch_id
        and s.validation_status not in ('valid', 'excluded')
    )
    or not exists (
      select 1 from accounting.import_staging_lines s
      where s.import_batch_id = new.import_batch_id
        and s.validation_status = 'valid'
    )
    or exists (
      select 1
      from accounting.import_files f
      where f.import_batch_id = new.import_batch_id
        and f.row_count <> (
          select count(*)
          from accounting.import_staging_lines s
          where s.import_batch_id = f.import_batch_id
            and s.import_file_id = f.import_file_id
        )
    )
  ) then
    raise exception 'BDF_ACCOUNTING_IMPORT_BATCH_VALIDATION_INCOMPLETE';
  end if;
  return new;
end
$function$;

-- Keep the M015 trigger names so ordering before M012 guard_* triggers is stable.
drop trigger a_m015_lock_import_batch_membership on accounting.import_batches;
drop trigger a_m015_seal_import_files on accounting.import_files;
drop trigger a_m015_seal_import_staging_lines on accounting.import_staging_lines;

create trigger a_m015_lock_import_batch_membership
before update of status on accounting.import_batches
for each row execute function accounting.guard_import_membership_seal_m063();

create trigger a_m015_seal_import_files
before insert or update or delete on accounting.import_files
for each row execute function accounting.guard_import_membership_seal_m063();

create trigger a_m015_seal_import_staging_lines
before insert or update or delete on accounting.import_staging_lines
for each row execute function accounting.guard_import_membership_seal_m063();

create constraint trigger revalidate_import_batch_membership_m063
after update of status on accounting.import_batches
deferrable initially deferred
for each row execute function accounting.revalidate_import_batch_membership_m063();

revoke execute on function accounting.guard_import_membership_seal_m063()
  from public, anon, authenticated, service_role;
revoke execute on function accounting.revalidate_import_batch_membership_m063()
  from public, anon, authenticated, service_role;

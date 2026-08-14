begin;

do $$
begin
  if to_regclass('public.employees') is null then
    raise exception using
      errcode = 'P0001',
      message = 'EMPLOYEE_EMERGENCY_CONTACT_CANONICAL_PARENT_MISSING';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employees'
      and column_name = 'id'
      and udt_name = 'uuid'
      and is_nullable = 'NO'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'EMPLOYEE_EMERGENCY_CONTACT_CANONICAL_PARENT_INVALID';
  end if;
end
$$;

create table public.employee_emergency_contacts (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  employee_phone_number text,
  updated_by_employee_id uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_emergency_contacts_phone_format_check
    check (
      employee_phone_number is null
      or employee_phone_number ~ '^\+?[0-9]{10,15}$'
    )
);

comment on table public.employee_emergency_contacts is
  '災害・緊急時に社員本人へ連絡するための限定連絡先。家族等の緊急連絡先とは分離する。';
comment on column public.employee_emergency_contacts.employee_phone_number is
  '社員本人の緊急連絡用電話番号。社員一覧、CSV、一般プロフィールへ公開しない。';

alter table public.employee_emergency_contacts enable row level security;

revoke all on table public.employee_emergency_contacts from public;
revoke all on table public.employee_emergency_contacts from anon;
revoke all on table public.employee_emergency_contacts from authenticated;
revoke all on table public.employee_emergency_contacts from service_role;
grant select, insert, update on table public.employee_emergency_contacts to service_role;

create table public.employee_emergency_contact_audit_logs (
  audit_id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  actor_employee_id uuid not null references public.employees(id),
  event_type text not null check (event_type in ('created', 'updated', 'cleared')),
  configured_before boolean not null,
  configured_after boolean not null,
  occurred_at timestamptz not null default now()
);

comment on table public.employee_emergency_contact_audit_logs is
  '緊急連絡先の設定状態だけを記録する追記専用監査。電話番号実値は保持しない。';

alter table public.employee_emergency_contact_audit_logs enable row level security;

revoke all on table public.employee_emergency_contact_audit_logs from public;
revoke all on table public.employee_emergency_contact_audit_logs from anon;
revoke all on table public.employee_emergency_contact_audit_logs from authenticated;
revoke all on table public.employee_emergency_contact_audit_logs from service_role;
grant select, insert on table public.employee_emergency_contact_audit_logs to service_role;

create function public.audit_employee_emergency_contact_change()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  insert into public.employee_emergency_contact_audit_logs (
    employee_id,
    actor_employee_id,
    event_type,
    configured_before,
    configured_after
  ) values (
    new.employee_id,
    new.updated_by_employee_id,
    case
      when tg_op = 'INSERT' then 'created'
      when new.employee_phone_number is null then 'cleared'
      else 'updated'
    end,
    case when tg_op = 'INSERT' then false else old.employee_phone_number is not null end,
    new.employee_phone_number is not null
  );
  return new;
end
$$;

revoke all on function public.audit_employee_emergency_contact_change() from public;
revoke all on function public.audit_employee_emergency_contact_change() from anon;
revoke all on function public.audit_employee_emergency_contact_change() from authenticated;
revoke all on function public.audit_employee_emergency_contact_change() from service_role;
grant execute on function public.audit_employee_emergency_contact_change() to service_role;

create trigger employee_emergency_contact_audit_trigger
after insert or update of employee_phone_number on public.employee_emergency_contacts
for each row execute function public.audit_employee_emergency_contact_change();

commit;

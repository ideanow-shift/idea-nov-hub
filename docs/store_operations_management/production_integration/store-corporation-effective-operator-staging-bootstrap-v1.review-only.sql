-- STAGING VALIDATION ONLY. Synthetic fixture; never apply to Production.
begin;

do $$
begin
  if pg_catalog.to_regnamespace('identity_access') is not null
     or pg_catalog.to_regprocedure('public.store_corporation_effective_operator_range_read_v1(date,date,uuid[])') is not null
     or pg_catalog.to_regprocedure('identity_access.store_corporation_effective_operator_range_read_internal_v1(date,date,uuid[])') is not null then
    raise exception 'STORE_CORPORATION_GATE5_STAGING_NOT_EMPTY';
  end if;
end;
$$;

create schema identity_access;
revoke all on schema identity_access from public, anon, authenticated, service_role;

create table identity_access.store_corporation_history_sets (
  history_set_id uuid primary key,
  batch_fingerprint text not null unique
);

create table identity_access.store_corporation_history_rows (
  history_row_id uuid primary key,
  history_set_id uuid not null references identity_access.store_corporation_history_sets(history_set_id),
  canonical_store_id uuid not null,
  corporation_id uuid not null,
  corporation_no text not null check (corporation_no ~ '^[0-9]{4}$'),
  effective_from date not null,
  effective_to date,
  valid_period daterange generated always as (
    daterange(effective_from, coalesce(effective_to + 1, 'infinity'::date), '[)')
  ) stored,
  unique (history_set_id, canonical_store_id, effective_from),
  check (effective_to is null or effective_to >= effective_from)
);

create table identity_access.store_corporation_history_publication (
  publication_key text primary key check (publication_key = 'active'),
  history_set_id uuid not null references identity_access.store_corporation_history_sets(history_set_id)
);

create view identity_access.store_corporation_history_v1
with (security_invoker = true)
as
select
  r.canonical_store_id as store_id,
  r.corporation_id,
  r.corporation_no,
  r.effective_from,
  r.effective_to,
  r.valid_period
from identity_access.store_corporation_history_publication p
join identity_access.store_corporation_history_sets s on s.history_set_id = p.history_set_id
join identity_access.store_corporation_history_rows r on r.history_set_id = s.history_set_id
where p.publication_key = 'active';

alter table identity_access.store_corporation_history_sets enable row level security;
alter table identity_access.store_corporation_history_sets force row level security;
alter table identity_access.store_corporation_history_rows enable row level security;
alter table identity_access.store_corporation_history_rows force row level security;
alter table identity_access.store_corporation_history_publication enable row level security;
alter table identity_access.store_corporation_history_publication force row level security;
revoke all on all tables in schema identity_access from public, anon, authenticated, service_role;

insert into identity_access.store_corporation_history_sets (history_set_id, batch_fingerprint)
values ('71000000-0000-4000-8000-000000000001', repeat('a', 64));

insert into identity_access.store_corporation_history_rows (
  history_row_id, history_set_id, canonical_store_id, corporation_id,
  corporation_no, effective_from, effective_to
) values
  ('72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001',
   '73000000-0000-4000-8000-000000000001', '74000000-0000-4000-8000-000000000001',
   '0001', date '2024-01-01', date '2024-12-31'),
  ('72000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000001',
   '73000000-0000-4000-8000-000000000001', '74000000-0000-4000-8000-000000000002',
   '0002', date '2025-01-01', null),
  ('72000000-0000-4000-8000-000000000003', '71000000-0000-4000-8000-000000000001',
   '73000000-0000-4000-8000-000000000002', '74000000-0000-4000-8000-000000000001',
   '0001', date '2024-01-01', null);

insert into identity_access.store_corporation_history_publication (publication_key, history_set_id)
values ('active', '71000000-0000-4000-8000-000000000001');

commit;

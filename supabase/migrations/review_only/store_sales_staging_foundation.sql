-- REVIEW-ONLY STAGING MIGRATION CANDIDATE.
-- Do not apply to any Supabase project without DEC-STG-001 and Security approval.
BEGIN;

create schema if not exists store_sales_staging;

create table if not exists store_sales_staging.audit_events (
  id uuid primary key,
  created_at timestamptz not null default now(),
  event_type text not null check (event_type in (
    'api_request','api_success','api_failure','access_denied','session_invalid',
    'contract_mismatch','timeout','projection_empty','missing_store','stale_data',
    'validation_error','maintenance','runtime_error'
  )),
  request_id uuid not null,
  actor_id text,
  role_key text,
  scope_key text,
  target_period text,
  store_id text,
  contract_version text not null,
  response_status integer,
  duration_ms integer,
  environment text not null check (environment = 'staging'),
  synthetic boolean not null check (synthetic = true)
);

alter table store_sales_staging.audit_events enable row level security;
revoke all on schema store_sales_staging from anon, authenticated;
revoke all on all tables in schema store_sales_staging from anon, authenticated;

-- No frontend policies. Backend access requires a separately reviewed least-privilege role.
-- Any SECURITY DEFINER function must use a NOLOGIN owner and:
-- set search_path = pg_catalog, store_sales_staging;

ROLLBACK;

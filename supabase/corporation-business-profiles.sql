begin;

create table if not exists public.corporation_business_profiles (
  corporation_id uuid primary key references public.corporations(id) on delete restrict,

  formal_corporation_name text,
  corporation_number text,
  invoice_registration_number text,
  representative_name text,
  head_office_address text,
  phone_number text,

  fiscal_year_end_month integer,
  payroll_closing_day text,
  payroll_payment_day text,
  accounting_category text,
  social_insurance_status text,
  labor_insurance_status text,
  tax_accountant_label text,
  labor_consultant_label text,

  operating_status text,
  established_on date,
  closed_on date,
  corporation_feature_note text,

  source_system text not null default 'hub_dashboard',
  source_version text,
  source_checked_at timestamptz,
  updated_by_employee_id uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint corporation_business_profiles_identity_length_check
    check (
      length(coalesce(formal_corporation_name, '')) <= 160
      and length(coalesce(corporation_number, '')) <= 32
      and length(coalesce(invoice_registration_number, '')) <= 32
      and length(coalesce(representative_name, '')) <= 80
    ),
  constraint corporation_business_profiles_contact_length_check
    check (
      length(coalesce(head_office_address, '')) <= 240
      and length(coalesce(phone_number, '')) <= 40
    ),
  constraint corporation_business_profiles_fiscal_month_check
    check (fiscal_year_end_month is null or fiscal_year_end_month between 1 and 12),
  constraint corporation_business_profiles_ops_length_check
    check (
      length(coalesce(payroll_closing_day, '')) <= 40
      and length(coalesce(payroll_payment_day, '')) <= 40
      and length(coalesce(accounting_category, '')) <= 80
      and length(coalesce(social_insurance_status, '')) <= 80
      and length(coalesce(labor_insurance_status, '')) <= 80
      and length(coalesce(tax_accountant_label, '')) <= 120
      and length(coalesce(labor_consultant_label, '')) <= 120
      and length(coalesce(operating_status, '')) <= 80
      and length(coalesce(corporation_feature_note, '')) <= 240
    ),
  constraint corporation_business_profiles_closed_after_established_check
    check (closed_on is null or established_on is null or closed_on >= established_on)
);

alter table public.corporation_business_profiles enable row level security;

create index if not exists corporation_business_profiles_fiscal_month_idx
  on public.corporation_business_profiles (fiscal_year_end_month);

create index if not exists corporation_business_profiles_operating_status_idx
  on public.corporation_business_profiles (operating_status);

revoke all on table public.corporation_business_profiles from anon;
revoke all on table public.corporation_business_profiles from authenticated;
grant select, insert, update on public.corporation_business_profiles to service_role;

commit;

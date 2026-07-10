begin;

create table if not exists public.store_business_profiles (
  store_id uuid primary key references public.stores(id) on delete restrict,

  regular_holiday_rule text,
  weekday_business_hours text,
  saturday_business_hours text,
  sunday_business_hours text,
  holiday_business_hours text,

  opened_on date,
  closed_on date,

  floor_area_tsubo numeric(8,2),
  floor_area_square_meter numeric(8,2),
  monthly_rent_including_common_fee numeric(12,0),
  rent_per_tsubo numeric(12,0),
  styling_seat_count integer,
  shampoo_station_count integer,
  rent_per_styling_seat numeric(12,0),

  affiliation_label text,
  operating_status text,
  store_feature_note text,

  source_system text not null default 'hub_dashboard',
  source_version text,
  source_checked_at timestamptz,
  updated_by_employee_id uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint store_business_profiles_hours_length_check
    check (
      length(coalesce(regular_holiday_rule, '')) <= 120
      and length(coalesce(weekday_business_hours, '')) <= 80
      and length(coalesce(saturday_business_hours, '')) <= 80
      and length(coalesce(sunday_business_hours, '')) <= 80
      and length(coalesce(holiday_business_hours, '')) <= 80
    ),
  constraint store_business_profiles_area_nonnegative_check
    check (
      coalesce(floor_area_tsubo, 0) >= 0
      and coalesce(floor_area_square_meter, 0) >= 0
    ),
  constraint store_business_profiles_rent_nonnegative_check
    check (
      coalesce(monthly_rent_including_common_fee, 0) >= 0
      and coalesce(rent_per_tsubo, 0) >= 0
      and coalesce(rent_per_styling_seat, 0) >= 0
    ),
  constraint store_business_profiles_capacity_nonnegative_check
    check (
      coalesce(styling_seat_count, 0) >= 0
      and coalesce(shampoo_station_count, 0) >= 0
    ),
  constraint store_business_profiles_note_length_check
    check (
      length(coalesce(affiliation_label, '')) <= 80
      and length(coalesce(operating_status, '')) <= 80
      and length(coalesce(store_feature_note, '')) <= 240
    ),
  constraint store_business_profiles_closed_after_open_check
    check (closed_on is null or opened_on is null or closed_on >= opened_on)
);

alter table public.store_business_profiles enable row level security;

create index if not exists store_business_profiles_opened_on_idx
  on public.store_business_profiles (opened_on);

create index if not exists store_business_profiles_operating_status_idx
  on public.store_business_profiles (operating_status);

revoke all on table public.store_business_profiles from anon;
revoke all on table public.store_business_profiles from authenticated;
grant select, insert, update on public.store_business_profiles to service_role;

commit;

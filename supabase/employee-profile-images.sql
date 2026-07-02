-- Employee profile image common asset.
-- Images are private Storage objects. Metadata is stored in Core DB and exposed by backend only.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employee-profile-images',
  'employee-profile-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.employee_profile_images (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  storage_bucket text not null default 'employee-profile-images',
  storage_path text not null,
  is_primary boolean not null default true,
  uploaded_by_employee_id uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.employee_profile_images enable row level security;

create unique index if not exists employee_profile_images_storage_object_uidx
  on public.employee_profile_images (storage_bucket, storage_path);

create unique index if not exists employee_profile_images_one_primary_uidx
  on public.employee_profile_images (employee_id)
  where is_primary = true;

create index if not exists idx_employee_profile_images_employee_id
  on public.employee_profile_images (employee_id);

grant select, insert, update on table public.employee_profile_images to service_role;

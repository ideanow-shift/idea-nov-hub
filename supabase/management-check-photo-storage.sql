-- Management Platform Phase2: Supabase Storage bootstrap and verification
-- Target: idea-nov-core / public
-- Bucket is private. Upload/read URLs are mediated by management-environment Edge Function using service_role.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'management-check-photos',
  'management-check-photos',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Verification 1: bucket exists and is private
select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id = 'management-check-photos';

-- Verification 2: photo metadata table is available to service_role
select
  grantee,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'management_check_photos'
  and grantee = 'service_role'
order by privilege_type;

-- Verification 3: RLS remains enabled on metadata table
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'management_check_photos';

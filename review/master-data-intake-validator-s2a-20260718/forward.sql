begin;

create function public.validate_master_data_intake_request(
  p_target text,
  p_file_digest text,
  p_preview_digest text,
  p_rows jsonb,
  p_expected_counts jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_allowed_headers text[];
  v_required_headers text[];
  v_forbidden_headers constant text[] := array[
    'PIN', 'pin', 'pin_hash', 'firebase_uid', 'firebaseUid',
    'role', 'roles', 'roleKeys', 'permissions',
    'LINE WORKS通知先ID', 'lineWorksRecipientId', 'channelId',
    '画像', 'profileImage', 'hrPrivateData'
  ];
  v_row_count integer;
  v_create_count integer;
  v_update_count integer;
  v_unchanged_count integer;
  v_error_count integer;
begin
  if p_target not in ('employees', 'stores', 'corporations') then
    raise exception using message = 'UNSUPPORTED_TARGET';
  end if;
  if p_file_digest is null or p_file_digest !~ '^[0-9a-f]{64}$'
    or p_preview_digest is null or p_preview_digest !~ '^[0-9a-f]{64}$' then
    raise exception using message = 'INVALID_DIGEST';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception using message = 'ROWS_NOT_ARRAY';
  end if;
  v_row_count := jsonb_array_length(p_rows);
  if v_row_count < 1 or v_row_count > 1000 then
    raise exception using message = 'ROW_COUNT_OUT_OF_RANGE';
  end if;
  if jsonb_typeof(p_expected_counts) is distinct from 'object'
    or (select count(*) from jsonb_object_keys(p_expected_counts)) <> 4
    or not (p_expected_counts ?& array['creates', 'updates', 'unchanged', 'errors'])
    or exists (
      select 1
      from jsonb_each(p_expected_counts) as item
      where item.key not in ('creates', 'updates', 'unchanged', 'errors')
        or jsonb_typeof(item.value) is distinct from 'number'
        or item.value::text !~ '^\d+$'
    ) then
    raise exception using message = 'INVALID_EXPECTED_COUNTS';
  end if;

  v_create_count := (p_expected_counts ->> 'creates')::integer;
  v_update_count := (p_expected_counts ->> 'updates')::integer;
  v_unchanged_count := (p_expected_counts ->> 'unchanged')::integer;
  v_error_count := (p_expected_counts ->> 'errors')::integer;
  if v_error_count <> 0
    or v_create_count + v_update_count + v_unchanged_count <> v_row_count then
    raise exception using message = 'EXPECTED_COUNTS_MISMATCH';
  end if;

  if p_target = 'employees' then
    v_required_headers := array['社員番号', '氏名'];
    v_allowed_headers := v_required_headers || array['メールアドレス', '所属', '雇用形態', '就労ステータス', '休職種別'];
  elsif p_target = 'stores' then
    v_required_headers := array['店舗ID', '店舗名'];
    v_allowed_headers := v_required_headers || array['店舗No', '法人', 'エリア', '状態'];
  else
    v_required_headers := array['法人No', '法人名'];
    v_allowed_headers := v_required_headers || array['正式名', '決算月', '状況', '有効'];
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rows) as row_value
    where jsonb_typeof(row_value) is distinct from 'object'
  ) then
    raise exception using message = 'ROW_NOT_OBJECT';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_rows) as row_value
    cross join lateral jsonb_object_keys(row_value) as field_name
    where field_name = any(v_forbidden_headers)
  ) then
    raise exception using message = 'FORBIDDEN_FIELD';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_rows) as row_value
    cross join lateral jsonb_object_keys(row_value) as field_name
    where not (field_name = any(v_allowed_headers))
  ) then
    raise exception using message = 'UNSUPPORTED_FIELD';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_rows) as row_value
    cross join unnest(v_required_headers) as required_header
    where not (row_value ? required_header)
      or btrim(coalesce(row_value ->> required_header, '')) = ''
  ) then
    raise exception using message = 'MISSING_REQUIRED_VALUE';
  end if;

  return jsonb_build_object(
    'ok', true,
    'target', p_target,
    'rowCount', v_row_count,
    'creates', v_create_count,
    'updates', v_update_count,
    'unchanged', v_unchanged_count
  );
end;
$$;

revoke all on function public.validate_master_data_intake_request(text,text,text,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.validate_master_data_intake_request(text,text,text,jsonb,jsonb)
  to service_role;

commit;

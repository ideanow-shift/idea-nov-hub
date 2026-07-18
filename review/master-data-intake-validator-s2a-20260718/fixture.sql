create function public.__test_master_data_intake_validator(
  p_target text,
  p_file_digest text,
  p_preview_digest text,
  p_rows jsonb,
  p_expected_counts jsonb,
  p_expect_success boolean
) returns boolean
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  perform public.validate_master_data_intake_request(
    p_target,
    p_file_digest,
    p_preview_digest,
    p_rows,
    p_expected_counts
  );
  return p_expect_success;
exception when others then
  return not p_expect_success;
end;
$$;

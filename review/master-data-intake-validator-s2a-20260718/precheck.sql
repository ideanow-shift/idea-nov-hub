select
  to_regprocedure('public.validate_master_data_intake_request(text,text,text,jsonb,jsonb)') is null,
  to_regprocedure('public.__test_master_data_intake_validator(text,text,text,jsonb,jsonb,boolean)') is null,
  exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role');

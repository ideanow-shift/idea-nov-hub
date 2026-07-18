with cases(result) as (
  values
    (public.__test_master_data_intake_validator('employees', repeat('a',64), repeat('b',64), '[{"社員番号":"0000","氏名":"SYNTHETIC"}]', '{"creates":1,"updates":0,"unchanged":0,"errors":0}', true)),
    (public.__test_master_data_intake_validator('stores', repeat('a',64), repeat('b',64), '[{"店舗ID":"synthetic","店舗名":"SYNTHETIC"}]', '{"creates":1,"updates":0,"unchanged":0,"errors":0}', true)),
    (public.__test_master_data_intake_validator('corporations', repeat('a',64), repeat('b',64), '[{"法人No":"0000","法人名":"SYNTHETIC"}]', '{"creates":1,"updates":0,"unchanged":0,"errors":0}', true)),
    (public.__test_master_data_intake_validator('unknown', repeat('a',64), repeat('b',64), '[{}]', '{"creates":1,"updates":0,"unchanged":0,"errors":0}', false)),
    (public.__test_master_data_intake_validator('employees', 'bad', repeat('b',64), '[{"社員番号":"0000","氏名":"SYNTHETIC"}]', '{"creates":1,"updates":0,"unchanged":0,"errors":0}', false)),
    (public.__test_master_data_intake_validator('employees', repeat('a',64), repeat('b',64), '[]', '{"creates":0,"updates":0,"unchanged":0,"errors":0}', false)),
    (public.__test_master_data_intake_validator('employees', repeat('a',64), repeat('b',64), '[{"社員番号":"0000","氏名":"SYNTHETIC","PIN":"1234"}]', '{"creates":1,"updates":0,"unchanged":0,"errors":0}', false)),
    (public.__test_master_data_intake_validator('employees', repeat('a',64), repeat('b',64), '[{"社員番号":"0000","氏名":"SYNTHETIC","unknown":"x"}]', '{"creates":1,"updates":0,"unchanged":0,"errors":0}', false)),
    (public.__test_master_data_intake_validator('employees', repeat('a',64), repeat('b',64), '[{"社員番号":"","氏名":"SYNTHETIC"}]', '{"creates":1,"updates":0,"unchanged":0,"errors":0}', false)),
    (public.__test_master_data_intake_validator('employees', repeat('a',64), repeat('b',64), '[{"社員番号":"0000","氏名":"SYNTHETIC"}]', '{"creates":0,"updates":0,"unchanged":1,"errors":1}', false))
), catalog as (
  select p.oid, p.prosecdef, p.proconfig
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'validate_master_data_intake_request'
)
select
  to_regprocedure('public.validate_master_data_intake_request(text,text,text,jsonb,jsonb)') is not null,
  (select prosecdef from catalog),
  (select proconfig = array['search_path=pg_catalog, public'] from catalog),
  (
    select count(*)
    from information_schema.routine_privileges
    where specific_schema = 'public'
      and routine_name = 'validate_master_data_intake_request'
      and grantee in ('PUBLIC','anon','authenticated')
  ),
  (
    select count(*)
    from information_schema.routine_privileges
    where specific_schema = 'public'
      and routine_name = 'validate_master_data_intake_request'
      and grantee = 'service_role'
      and privilege_type = 'EXECUTE'
  ),
  count(*) filter (where result),
  count(*)
from cases;

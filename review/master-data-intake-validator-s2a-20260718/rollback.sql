begin;

drop function public.__test_master_data_intake_validator(text,text,text,jsonb,jsonb,boolean);
drop function public.validate_master_data_intake_request(text,text,text,jsonb,jsonb);

commit;

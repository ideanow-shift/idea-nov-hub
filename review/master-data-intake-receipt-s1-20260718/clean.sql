select
  to_regclass('public.master_data_intake_receipts') is null,
  to_regclass('public.employees') is not null,
  to_regprocedure('public.commit_master_data_intake(text,uuid,text,text,jsonb,jsonb,uuid)') is null;

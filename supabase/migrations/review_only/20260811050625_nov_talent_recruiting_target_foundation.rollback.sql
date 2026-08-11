-- Review-only rollback. Disable NOV_TALENT_RECRUITING_TARGET_WRITES_ENABLED first.
do $$ begin
  if exists(select 1 from public.nov_talent_recruiting_targets_v1) then
    raise exception using errcode='55000',message='RECRUITING_TARGET_ROLLBACK_REQUIRES_EMPTY_TABLES';
  end if;
end $$;
drop function if exists public.nov_talent_supersede_recruiting_target_v1(uuid,text,uuid,integer);
drop function if exists public.nov_talent_approve_recruiting_target_v1(uuid,text,uuid,integer);
drop function if exists public.nov_talent_create_recruiting_target_draft_v1(uuid,text,integer,text,text,date,date,text,integer,date,date,text);
drop table if exists public.nov_talent_recruiting_target_audit_v1;
drop table if exists public.nov_talent_recruiting_targets_v1;
drop function if exists public.nov_talent_recruiting_target_audit_immutable_v1();
drop function if exists public.nov_talent_recruiting_target_immutable_v1();

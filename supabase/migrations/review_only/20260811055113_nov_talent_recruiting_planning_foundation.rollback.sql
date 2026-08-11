-- Review-only rollback. Never removes the merged #102 Recruiting Target Foundation.
do $$ begin
 if exists(select 1 from public.nov_talent_recruiting_funnel_targets_v1) or exists(select 1 from public.nov_talent_recruiting_budgets_v1)
 then raise exception using errcode='55000',message='RECRUITING_PLANNING_ROLLBACK_REQUIRES_EMPTY_TABLES'; end if;
end $$;
drop function if exists public.nov_talent_approve_planning_budget_v1(uuid,text,uuid,integer);
drop function if exists public.nov_talent_create_planning_budget_draft_v1(uuid,text,text,integer,text,date,date,bigint,text,date,date,text,jsonb);
drop function if exists public.nov_talent_approve_planning_target_v1(uuid,text,uuid,integer);
drop function if exists public.nov_talent_create_planning_target_draft_v1(uuid,text,text,integer,text,text,date,date,integer,date,date,text);
drop table if exists public.nov_talent_recruiting_budget_audit_v1;
drop table if exists public.nov_talent_recruiting_budget_lines_v1;
drop table if exists public.nov_talent_recruiting_budgets_v1;
drop table if exists public.nov_talent_recruiting_funnel_target_audit_v1;
drop table if exists public.nov_talent_recruiting_funnel_targets_v1;
drop function if exists public.nov_talent_planning_append_only_v1();
drop function if exists public.nov_talent_planning_immutable_v1();

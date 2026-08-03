begin;
set local statement_timeout = '5s';
set local lock_timeout = '1s';

do $precheck$
declare
  fn_oid oid := pg_catalog.to_regprocedure('public.thanks_coin_appreciation_analytics(text)');
begin
  if fn_oid is null
     or pg_catalog.to_regclass('public.idea_link_posts') is null
     or pg_catalog.to_regclass('public.stores') is null
     or pg_catalog.to_regclass('public.employee_store_assignments') is null then
    raise exception 'ANALYTICS_PUBLIC_ONLY_PRECHECK_FAILED';
  end if;
  if exists (
    select 1
    from pg_catalog.aclexplode(coalesce(
      (select p.proacl from pg_catalog.pg_proc p where p.oid=fn_oid),
      pg_catalog.acldefault('f',(select p.proowner from pg_catalog.pg_proc p where p.oid=fn_oid))
    )) x
    left join pg_catalog.pg_roles r on r.oid=x.grantee
    where x.privilege_type='EXECUTE'
      and (x.grantee=0 or r.rolname in ('anon','authenticated'))
  ) then
    raise exception 'ANALYTICS_PUBLIC_ONLY_BROWSER_GRANT_PRESENT';
  end if;
end
$precheck$;

create or replace function public.thanks_coin_appreciation_analytics(p_period_category text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $function$
with bounds as (
  select
    case p_period_category
      when 'CURRENT_MONTH' then pg_catalog.date_trunc('month',pg_catalog.statement_timestamp())
      when 'PREVIOUS_MONTH' then pg_catalog.date_trunc('month',pg_catalog.statement_timestamp())-interval '1 month'
      when 'CURRENT_FISCAL_YEAR' then pg_catalog.make_timestamptz(
        extract(year from pg_catalog.statement_timestamp())::integer
          - case when extract(month from pg_catalog.statement_timestamp())<4 then 1 else 0 end,
        4,1,0,0,0,'UTC')
      when 'ROLLING_12_MONTHS' then pg_catalog.date_trunc('month',pg_catalog.statement_timestamp())-interval '11 months'
    end as period_start,
    case p_period_category
      when 'CURRENT_MONTH' then pg_catalog.date_trunc('month',pg_catalog.statement_timestamp())+interval '1 month'
      when 'PREVIOUS_MONTH' then pg_catalog.date_trunc('month',pg_catalog.statement_timestamp())
      when 'CURRENT_FISCAL_YEAR' then pg_catalog.make_timestamptz(
        extract(year from pg_catalog.statement_timestamp())::integer
          - case when extract(month from pg_catalog.statement_timestamp())<4 then 0 else -1 end,
        4,1,0,0,0,'UTC')
      when 'ROLLING_12_MONTHS' then pg_catalog.date_trunc('month',pg_catalog.statement_timestamp())+interval '1 month'
    end as period_end
), public_rows as (
  select distinct on (p.request_id)
    p.request_id,p.created_at,p.category,p.receiver_store_id,p.sender_id,p.receiver_id
  from public.idea_link_posts p cross join bounds b
  where b.period_start is not null and b.period_end is not null
    and p.created_at>=b.period_start and p.created_at<b.period_end
    and p.status='active'
    and p.visibility='public'
  order by p.request_id,p.created_at,p.id
), categories(category,ordinal) as (
  values ('笑顔で挨拶する',1),('約束を守る',2),('助け合う',3),('伝え合う',4),('思いやり',5),('未設定',6)
), category_rows as (
  select c.category,c.ordinal,
    case when pg_catalog.count(p.*)=0 then 'NONE'
      when pg_catalog.count(p.*)<5 then 'LOW'
      when pg_catalog.count(p.*)<15 then 'MEDIUM' else 'HIGH' end as activity_category
  from categories c
  left join public_rows p on coalesce(nullif(p.category,''),'未設定')=c.category
  group by c.category,c.ordinal
), organization_members as (
  select a.store_id,pg_catalog.count(distinct a.employee_id) as member_count
  from public.employee_store_assignments a
  where a.is_active is true
  group by a.store_id
), organization_rows as (
  select s.store_name,
    case when pg_catalog.count(*)<5 then 'LOW'
      when pg_catalog.count(*)<15 then 'MEDIUM' else 'HIGH' end as activity_category
  from public_rows p
  join organization_members m on m.store_id=p.receiver_store_id and m.member_count>=5
  join public.stores s on s.id=p.receiver_store_id
  where s.store_name is not null and s.store_name<>''
  group by s.store_name
), months as (
  select g.month_start,row_number() over(order by g.month_start)::integer as ordinal
  from bounds b
  cross join lateral pg_catalog.generate_series(
    pg_catalog.date_trunc('month',b.period_start),
    pg_catalog.date_trunc('month',b.period_end-interval '1 microsecond'),
    interval '1 month'
  ) g(month_start)
  where b.period_start is not null and b.period_end is not null
), month_counts as (
  select m.month_start,m.ordinal,pg_catalog.count(p.*) as post_count
  from months m left join public_rows p
    on p.created_at>=m.month_start and p.created_at<m.month_start+interval '1 month'
  group by m.month_start,m.ordinal
), month_compared as (
  select *,pg_catalog.lag(post_count) over(order by month_start) as previous_count from month_counts
), flags as (
  select
    exists(
      select 1 from public.idea_link_posts p cross join bounds b
      where b.period_start is not null and b.period_end is not null
        and p.created_at>=b.period_start and p.created_at<b.period_end
        and p.status='active'
        and (p.visibility not in ('public','private') or p.visibility is null)
    ) as unknown_visibility,
    exists(
      select 1 from public_rows p left join organization_members m on m.store_id=p.receiver_store_id
      where p.receiver_store_id is null or m.member_count is null or m.member_count<5
    ) as suppressed
)
select pg_catalog.jsonb_build_object(
  'periodCategory',p_period_category,
  'overallPostCount',(select pg_catalog.count(*) from public_rows),
  'participatingSenderCount',(select pg_catalog.count(distinct sender_id) from public_rows where sender_id is not null),
  'participatingRecipientCount',(select pg_catalog.count(distinct receiver_id) from public_rows where receiver_id is not null),
  'monthlyTrend',coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'monthCategory','M'||pg_catalog.lpad(ordinal::text,2,'0'),
      'trendCategory',case when previous_count is null or previous_count<5 or post_count<5 then 'INSUFFICIENT_DATA'
        when post_count>previous_count then 'UP' when post_count<previous_count then 'DOWN' else 'STABLE' end
    ) order by ordinal) from month_compared
  ),'[]'::jsonb),
  'categoryDistribution',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('category',category,'activityCategory',activity_category) order by ordinal) from category_rows),
  'organizationDistribution',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('organizationLabel',store_name,'activityCategory',activity_category) order by store_name) from organization_rows),'[]'::jsonb),
  'suppressedGroupPresent',(select suppressed from flags),
  'unknownVisibilityExcluded',(select unknown_visibility from flags),
  'qualityFlagCategory',(select case when unknown_visibility then 'UNKNOWN_VISIBILITY_EXCLUDED' else 'OK' end from flags),
  'rawValuesIncluded',false
)
where p_period_category in ('CURRENT_MONTH','PREVIOUS_MONTH','CURRENT_FISCAL_YEAR','ROLLING_12_MONTHS');
$function$;

revoke all on function public.thanks_coin_appreciation_analytics(text) from public,anon,authenticated;
grant execute on function public.thanks_coin_appreciation_analytics(text) to service_role;

do $postcheck$
declare
  fn_oid oid := pg_catalog.to_regprocedure('public.thanks_coin_appreciation_analytics(text)');
  fn_source text;
begin
  select p.prosrc into fn_source from pg_catalog.pg_proc p where p.oid=fn_oid;
  if fn_oid is null
     or fn_source not like '%p.visibility=''public''%'
     or fn_source like '%count(*) from known%'
     or fn_source like '%left join known%'
     or not exists (
       select 1 from pg_catalog.pg_proc p
       where p.oid=fn_oid and p.prosecdef and p.provolatile='s'
         and p.prorettype=pg_catalog.to_regtype('jsonb')
         and p.proconfig @> array['search_path=pg_catalog']::text[]
     ) then
    raise exception 'ANALYTICS_PUBLIC_ONLY_POSTCHECK_FAILED';
  end if;
  if exists (
    select 1
    from pg_catalog.aclexplode(coalesce(
      (select p.proacl from pg_catalog.pg_proc p where p.oid=fn_oid),
      pg_catalog.acldefault('f',(select p.proowner from pg_catalog.pg_proc p where p.oid=fn_oid))
    )) x
    left join pg_catalog.pg_roles r on r.oid=x.grantee
    where x.privilege_type='EXECUTE'
      and (x.grantee=0 or r.rolname in ('anon','authenticated'))
  ) then
    raise exception 'ANALYTICS_PUBLIC_ONLY_GRANT_POSTCHECK_FAILED';
  end if;
end
$postcheck$;

commit;

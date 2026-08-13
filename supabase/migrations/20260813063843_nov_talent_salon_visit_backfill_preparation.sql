-- PREPARATION CANDIDATE ONLY. DO NOT APPLY OR EXECUTE WITHOUT A SEPARATE OWNER GATE.
-- Forward-only support for the 2027 NEW_GRAD SALON_VISIT Human Review package.
begin;

alter table public.nov_talent_recruiting_engagement_facts_v1
  add column source_event_id uuid references public.nov_talent_recruitment_events_v1(event_id) on delete restrict;

create index nov_talent_engagement_source_event_fk_v1
  on public.nov_talent_recruiting_engagement_facts_v1 (source_event_id)
  where source_event_id is not null;

create unique index nov_talent_salon_visit_source_event_store_original_v1
  on public.nov_talent_recruiting_engagement_facts_v1 (source_event_id,store_id)
  where engagement_type='SALON_VISIT' and source_event_id is not null and correction_of_fact_id is null;

create table public.nov_talent_recruiting_salon_visit_backfill_receipts_v1 (
  backfill_receipt_id uuid primary key default gen_random_uuid(),
  backfill_code text not null check (backfill_code='SALON_VISIT_2027_HUMAN_REVIEW'),
  receipt_state text not null check (receipt_state in ('COMPLETED','VOIDED')),
  review_status text not null check (review_status='APPROVED_FOR_BACKFILL'),
  review_package_sha256 text not null check (review_package_sha256 ~ '^[0-9a-f]{64}$'),
  canonical_source_sha256 text not null check (canonical_source_sha256 ~ '^[0-9a-f]{64}$'),
  source_event_count integer not null check (source_event_count >= 0),
  unique_candidate_count integer not null check (unique_candidate_count >= 0),
  fact_count integer not null check (fact_count >= 0),
  original_actor_status text not null check (original_actor_status='UNAVAILABLE'),
  supersedes_receipt_id uuid unique references public.nov_talent_recruiting_salon_visit_backfill_receipts_v1(backfill_receipt_id) on delete restrict,
  actor_employee_id uuid not null,
  actor_role text not null check (actor_role in ('super_admin','hr.admin','backoffice')),
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  created_at timestamptz not null default statement_timestamp(),
  constraint nov_talent_salon_visit_backfill_receipt_shape_v1 check (
    (receipt_state='COMPLETED' and supersedes_receipt_id is null)
    or (receipt_state='VOIDED' and supersedes_receipt_id is not null)
  ),
  unique (backfill_code,receipt_state)
);

create trigger nov_talent_salon_visit_backfill_receipt_append_only_v1
before update or delete on public.nov_talent_recruiting_salon_visit_backfill_receipts_v1
for each row execute function public.nov_talent_actual_fact_append_only_v1();

create function nov_talent_internal.salon_visit_2027_human_review_mappings_v1()
returns table(source_event_id uuid,store_id uuid)
language sql immutable security definer set search_path='' as $function$
  values
    ('8f49acef-d972-4184-99d5-1dbdeda07c2f'::uuid,'36c222de-0554-4265-b177-3b68285cc4a4'::uuid),
    ('8f49acef-d972-4184-99d5-1dbdeda07c2f'::uuid,'ac20934d-ef15-4363-8c2f-759193c7fcc7'::uuid),
    ('8f49acef-d972-4184-99d5-1dbdeda07c2f'::uuid,'887da14c-2c0d-46b3-8953-962c7c8dd590'::uuid),
    ('46d30134-1e53-460d-9aa0-6ab05f411cb7'::uuid,'5f66193f-d360-4967-b9c7-a100c8ee5e94'::uuid),
    ('edb2e971-3667-430a-92ad-423a26231dc3'::uuid,'36c222de-0554-4265-b177-3b68285cc4a4'::uuid),
    ('edb2e971-3667-430a-92ad-423a26231dc3'::uuid,'887da14c-2c0d-46b3-8953-962c7c8dd590'::uuid),
    ('edb2e971-3667-430a-92ad-423a26231dc3'::uuid,'ac20934d-ef15-4363-8c2f-759193c7fcc7'::uuid),
    ('edb2e971-3667-430a-92ad-423a26231dc3'::uuid,'5f66193f-d360-4967-b9c7-a100c8ee5e94'::uuid),
    ('edb2e971-3667-430a-92ad-423a26231dc3'::uuid,'71551fcf-853f-4cad-ac94-82b93e75de82'::uuid),
    ('5b5fa241-ecab-46c2-b1cd-c31a9a3af6d2'::uuid,'36c222de-0554-4265-b177-3b68285cc4a4'::uuid),
    ('5b5fa241-ecab-46c2-b1cd-c31a9a3af6d2'::uuid,'ac20934d-ef15-4363-8c2f-759193c7fcc7'::uuid),
    ('5b5fa241-ecab-46c2-b1cd-c31a9a3af6d2'::uuid,'887da14c-2c0d-46b3-8953-962c7c8dd590'::uuid),
    ('5b5fa241-ecab-46c2-b1cd-c31a9a3af6d2'::uuid,'b898c63f-1cc1-42c5-be4f-916f24f49cb6'::uuid),
    ('5b5fa241-ecab-46c2-b1cd-c31a9a3af6d2'::uuid,'1bcba30a-d063-4cdb-be74-425e250aeb25'::uuid),
    ('5b5fa241-ecab-46c2-b1cd-c31a9a3af6d2'::uuid,'e7ecb022-6b19-4952-bf4b-fbf5f4c53895'::uuid)
$function$;

create function nov_talent_internal.salon_visit_2027_backfill_state_v1()
returns jsonb language plpgsql stable security definer set search_path='' as $function$
declare
  v_review_sha constant text := '10c87773b376dddaf044dc1c3e2dd88e68b759e2a237df0e406a8a563a192540';
  v_source_sha constant text := 'ed954ba2a5553ab645d5050cd8ed036aad6e749435d09a9fcfe256255426c023';
  v_source_events integer;
  v_candidates integer;
  v_store_mappings integer;
  v_stores integer;
  v_fingerprints integer;
  v_unexpected_events integer;
  v_source_digest text;
  v_facts integer;
  v_fact_source_events integer;
  v_audits integer;
  v_cancellation_facts integer;
  v_cancellation_audits integer;
  v_completed integer;
  v_voided integer;
begin
  select count(*) filter (where receipt_state='COMPLETED'),count(*) filter (where receipt_state='VOIDED')
    into v_completed,v_voided
  from public.nov_talent_recruiting_salon_visit_backfill_receipts_v1
  where backfill_code='SALON_VISIT_2027_HUMAN_REVIEW';

  select count(*),count(distinct candidate_id),count(distinct source_event_id)
    into v_facts,v_candidates,v_fact_source_events
  from public.nov_talent_recruiting_engagement_facts_v1
  where source_type='CONTACTS_27_SALON_VISIT_HUMAN_REVIEW';

  if v_completed > 0 then
    select count(*) into v_audits
    from public.nov_talent_recruiting_engagement_audit_v1 a
    join public.nov_talent_recruiting_engagement_facts_v1 f using (engagement_fact_id)
    where f.source_type='CONTACTS_27_SALON_VISIT_HUMAN_REVIEW' and a.event_type='FACT_APPENDED';
    select count(*) into v_cancellation_facts
    from public.nov_talent_recruiting_engagement_facts_v1
    where source_type='CONTACTS_27_SALON_VISIT_HUMAN_REVIEW_VOID'
      and engagement_status='CANCELLED' and correction_of_fact_id is not null;
    select count(*) into v_cancellation_audits
    from public.nov_talent_recruiting_engagement_audit_v1 a
    join public.nov_talent_recruiting_engagement_facts_v1 f using (engagement_fact_id)
    where f.source_type='CONTACTS_27_SALON_VISIT_HUMAN_REVIEW_VOID'
      and a.event_type='CANCELLATION_APPENDED';
    return jsonb_build_object(
      'state',case when v_voided=1 and v_completed=1 and v_facts=15 and v_candidates=4
                     and v_fact_source_events=4 and v_audits=15
                     and v_cancellation_facts=15 and v_cancellation_audits=15 then 'VOIDED'
                   when v_voided=0 and v_completed=1 and v_facts=15 and v_candidates=4
                     and v_fact_source_events=4 and v_audits=15 then 'COMPLETED'
                   else 'BLOCKED' end,
      'exactPreflightPassed',false,'reviewPackageSha256',v_review_sha,
      'canonicalSourceSha256',v_source_sha,'sourceEventCount',4,'storeVisitFactCount',15,
      'uniqueCandidateCount',4,'distinctStoreCount',8,'existingFactCount',v_facts,
      'existingAuditCount',v_audits,'cancellationFactCount',v_cancellation_facts,
      'cancellationAuditCount',v_cancellation_audits,'originalActorStatus','UNAVAILABLE'
    );
  end if;

  with mappings as (
    select * from nov_talent_internal.salon_visit_2027_human_review_mappings_v1()
  ), eligible as (
    select m.source_event_id,m.store_id,e.candidate_id,e.event_date,e.event_state,e.source_type,
      e.source_row_no,e.source_field_code,e.source_fingerprint,e.is_active,e.invalidated_at,
      e.correction_of_event_id
    from mappings m
    join public.nov_talent_recruitment_events_v1 e on e.event_id=m.source_event_id
    join public.nov_talent_candidates_v1 c on c.candidate_id=e.candidate_id
    where e.event_code='SALON_TOUR_COMPLETED' and e.source_type='CONTACTS_27'
      and e.source_field_code='SALON_TOUR_DATE_1' and e.event_state='COMPLETED'
      and e.is_active and e.invalidated_at is null and e.correction_of_event_id is null
      and e.event_date between date '2026-04-01' and date '2027-03-31'
      and c.graduation_year=2027 and c.is_active
  ), lines as (
    select source_event_id,store_id,concat_ws('|',source_event_id::text,store_id::text,
      candidate_id::text,event_date::text,event_state,source_type,source_row_no::text,
      source_field_code,source_fingerprint,case when is_active then 'true' else 'false' end,
      coalesce(invalidated_at::text,''),coalesce(correction_of_event_id::text,'')) as line
    from eligible
  ), approved_events as (
    select distinct source_event_id from mappings
  ), unexpected as (
    select e.event_id
    from public.nov_talent_recruitment_events_v1 e
    join public.nov_talent_candidates_v1 c on c.candidate_id=e.candidate_id
    left join approved_events a on a.source_event_id=e.event_id
    where e.event_code='SALON_TOUR_COMPLETED' and e.source_type='CONTACTS_27'
      and e.event_state='COMPLETED' and e.is_active and e.invalidated_at is null
      and e.event_date between date '2026-04-01' and date '2027-03-31'
      and c.graduation_year=2027 and c.is_active and a.source_event_id is null
  )
  select (select count(distinct source_event_id) from eligible),
         (select count(distinct candidate_id) from eligible),
         (select count(*) from eligible),(select count(distinct store_id) from eligible),
         (select count(distinct source_fingerprint) from eligible),(select count(*) from unexpected),
         encode(extensions.digest(coalesce(string_agg(line,E'\n' order by source_event_id,store_id),''),'sha256'),'hex')
    into v_source_events,v_candidates,v_store_mappings,v_stores,v_fingerprints,v_unexpected_events,v_source_digest
  from lines;

  return jsonb_build_object(
    'state',case when v_source_events=4 and v_candidates=4 and v_store_mappings=15
      and v_stores=8 and v_fingerprints=4 and v_unexpected_events=0
      and v_source_digest=v_source_sha and v_facts=0 and v_completed=0 and v_voided=0
      then 'PASS' else 'BLOCKED' end,
    'exactPreflightPassed',v_source_events=4 and v_candidates=4 and v_store_mappings=15
      and v_stores=8 and v_fingerprints=4 and v_unexpected_events=0
      and v_source_digest=v_source_sha and v_facts=0 and v_completed=0 and v_voided=0,
    'reviewPackageSha256',v_review_sha,'canonicalSourceSha256',v_source_digest,
    'sourceEventCount',v_source_events,'storeVisitFactCount',v_store_mappings,
    'uniqueCandidateCount',v_candidates,'distinctStoreCount',v_stores,
    'distinctFingerprintCount',v_fingerprints,'unexpectedSourceEventCount',v_unexpected_events,
    'existingFactCount',v_facts,'originalActorStatus','UNAVAILABLE'
  );
exception when others then
  return jsonb_build_object('state','UNAVAILABLE','exactPreflightPassed',false,
    'reviewPackageSha256',v_review_sha,'canonicalSourceSha256',v_source_sha,
    'sourceEventCount',null,'storeVisitFactCount',null,'uniqueCandidateCount',null,
    'distinctStoreCount',null,'unexpectedSourceEventCount',null,'existingFactCount',null,
    'originalActorStatus','UNAVAILABLE');
end
$function$;

create function public.nov_talent_preflight_salon_visit_2027_backfill_v1()
returns table(
  state text,exact_preflight_passed boolean,review_package_sha256 text,
  canonical_source_sha256 text,source_event_count integer,store_visit_fact_count integer,
  unique_candidate_count integer,distinct_store_count integer,unexpected_source_event_count integer,
  existing_fact_count integer,original_actor_status text
) language sql stable security definer set search_path='' as $function$
  select v->>'state',(v->>'exactPreflightPassed')::boolean,v->>'reviewPackageSha256',
    v->>'canonicalSourceSha256',(v->>'sourceEventCount')::integer,
    (v->>'storeVisitFactCount')::integer,(v->>'uniqueCandidateCount')::integer,
    (v->>'distinctStoreCount')::integer,(v->>'unexpectedSourceEventCount')::integer,
    (v->>'existingFactCount')::integer,v->>'originalActorStatus'
  from (select nov_talent_internal.salon_visit_2027_backfill_state_v1() v) q
$function$;

create function public.nov_talent_execute_salon_visit_2027_backfill_v1(
  p_actor_employee_id uuid,p_actor_role text,p_review_package_sha256 text,p_canonical_source_sha256 text
) returns table(backfill_receipt_id uuid,fact_count integer,source_event_count integer,unique_candidate_count integer)
language plpgsql security definer set search_path='' as $function$
declare
  v_review_sha constant text := '10c87773b376dddaf044dc1c3e2dd88e68b759e2a237df0e406a8a563a192540';
  v_source_sha constant text := 'ed954ba2a5553ab645d5050cd8ed036aad6e749435d09a9fcfe256255426c023';
  v_state jsonb;
  v_receipt uuid;
  v_fact_count integer;
  v_source_event_count integer;
  v_candidate_count integer;
  v_audit_count integer;
begin
  if p_actor_employee_id is null or p_actor_role not in ('super_admin','hr.admin','backoffice') then
    raise exception using errcode='42501',message='SALON_VISIT_BACKFILL_ROLE_FORBIDDEN';
  end if;
  if lower(coalesce(p_review_package_sha256,''))<>v_review_sha
    or lower(coalesce(p_canonical_source_sha256,''))<>v_source_sha then
    raise exception using errcode='22023',message='SALON_VISIT_BACKFILL_APPROVAL_DIGEST_MISMATCH';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('NOV_TALENT_SALON_VISIT_2027_BACKFILL',0));
  perform 1
  from nov_talent_internal.salon_visit_2027_human_review_mappings_v1() m
  join public.nov_talent_recruitment_events_v1 e on e.event_id=m.source_event_id
  join public.nov_talent_candidates_v1 c on c.candidate_id=e.candidate_id
  for share of e,c;
  v_state:=nov_talent_internal.salon_visit_2027_backfill_state_v1();
  if v_state->>'state'<>'PASS' or (v_state->>'exactPreflightPassed')::boolean is not true then
    raise exception using errcode='40001',message='SALON_VISIT_BACKFILL_EXACT_PREFLIGHT_FAILED';
  end if;

  with inserted as (
    insert into public.nov_talent_recruiting_engagement_facts_v1(
      candidate_id,engagement_type,occurred_at,store_id,engagement_status,
      source_type,source_reference,source_fingerprint,actor_employee_id,original_actor_status,
      source_event_id
    )
    select e.candidate_id,'SALON_VISIT',e.event_date::timestamp at time zone 'UTC',m.store_id,'COMPLETED',
      'CONTACTS_27_SALON_VISIT_HUMAN_REVIEW',
      'CONTACTS_27:EVENT:'||e.event_id::text||':STORE:'||m.store_id::text,
      encode(extensions.digest(e.source_fingerprint||'|SALON_VISIT|'||m.store_id::text,'sha256'),'hex'),
      p_actor_employee_id,'UNAVAILABLE',e.event_id
    from nov_talent_internal.salon_visit_2027_human_review_mappings_v1() m
    join public.nov_talent_recruitment_events_v1 e on e.event_id=m.source_event_id
    join public.nov_talent_candidates_v1 c on c.candidate_id=e.candidate_id
    where e.event_code='SALON_TOUR_COMPLETED' and e.source_type='CONTACTS_27'
      and e.source_field_code='SALON_TOUR_DATE_1' and e.event_state='COMPLETED'
      and e.is_active and e.invalidated_at is null and e.correction_of_event_id is null
      and e.event_date between date '2026-04-01' and date '2027-03-31'
      and c.graduation_year=2027 and c.is_active
    order by e.event_date,e.event_id,m.store_id
    returning engagement_fact_id
  )
  insert into public.nov_talent_recruiting_engagement_audit_v1(
    engagement_fact_id,event_type,actor_employee_id,actor_role
  ) select engagement_fact_id,'FACT_APPENDED',p_actor_employee_id,p_actor_role from inserted;
  get diagnostics v_audit_count=row_count;

  select count(*),count(distinct source_event_id),count(distinct candidate_id)
    into v_fact_count,v_source_event_count,v_candidate_count
  from public.nov_talent_recruiting_engagement_facts_v1
  where source_type='CONTACTS_27_SALON_VISIT_HUMAN_REVIEW';
  if v_fact_count<>15 or v_source_event_count<>4 or v_candidate_count<>4 or v_audit_count<>15 then
    raise exception using errcode='40001',message='SALON_VISIT_BACKFILL_ATOMIC_COUNT_MISMATCH';
  end if;

  insert into public.nov_talent_recruiting_salon_visit_backfill_receipts_v1(
    backfill_code,receipt_state,review_status,review_package_sha256,canonical_source_sha256,
    source_event_count,unique_candidate_count,fact_count,original_actor_status,
    actor_employee_id,actor_role,reason
  ) values(
    'SALON_VISIT_2027_HUMAN_REVIEW','COMPLETED','APPROVED_FOR_BACKFILL',v_review_sha,v_source_sha,
    4,4,15,'UNAVAILABLE',p_actor_employee_id,p_actor_role,
    'Owner-approved SALON_VISIT Human Review package backfill'
  ) returning nov_talent_recruiting_salon_visit_backfill_receipts_v1.backfill_receipt_id into v_receipt;
  return query select v_receipt,v_fact_count,v_source_event_count,v_candidate_count;
end
$function$;

-- Post-commit recovery is append-only. It is intentionally not exposed by the Edge Operator.
create function public.nov_talent_void_salon_visit_2027_backfill_v1(
  p_actor_employee_id uuid,p_actor_role text,p_completed_receipt_id uuid,p_reason text
) returns table(void_receipt_id uuid,cancellation_fact_count integer)
language plpgsql security definer set search_path='' as $function$
declare v_completed public.nov_talent_recruiting_salon_visit_backfill_receipts_v1;v_receipt uuid;v_count integer;
begin
  if p_actor_employee_id is null or p_actor_role not in ('super_admin','hr.admin','backoffice') then raise exception using errcode='42501',message='SALON_VISIT_BACKFILL_VOID_ROLE_FORBIDDEN'; end if;
  if char_length(btrim(coalesce(p_reason,''))) not between 1 and 500 then raise exception using errcode='22023',message='SALON_VISIT_BACKFILL_VOID_REASON_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('NOV_TALENT_SALON_VISIT_2027_BACKFILL',0));
  select * into strict v_completed from public.nov_talent_recruiting_salon_visit_backfill_receipts_v1
  where backfill_receipt_id=p_completed_receipt_id and backfill_code='SALON_VISIT_2027_HUMAN_REVIEW'
    and receipt_state='COMPLETED' for share;
  if exists(select 1 from public.nov_talent_recruiting_salon_visit_backfill_receipts_v1 where supersedes_receipt_id=p_completed_receipt_id) then raise exception using errcode='23505',message='SALON_VISIT_BACKFILL_ALREADY_VOIDED'; end if;
  with inserted as (
    insert into public.nov_talent_recruiting_engagement_facts_v1(
      candidate_id,engagement_type,occurred_at,store_id,engagement_status,source_type,
      source_reference,source_fingerprint,actor_employee_id,original_actor_status,
      correction_of_fact_id,correction_reason,source_event_id
    )
    select f.candidate_id,'SALON_VISIT',f.occurred_at,f.store_id,'CANCELLED',
      'CONTACTS_27_SALON_VISIT_HUMAN_REVIEW_VOID','VOID:'||f.engagement_fact_id::text,
      encode(extensions.digest(f.source_fingerprint||'|VOID|'||p_completed_receipt_id::text,'sha256'),'hex'),
      p_actor_employee_id,'UNAVAILABLE',f.engagement_fact_id,btrim(p_reason),f.source_event_id
    from public.nov_talent_recruiting_engagement_facts_v1 f
    where f.source_type='CONTACTS_27_SALON_VISIT_HUMAN_REVIEW' and f.correction_of_fact_id is null
    order by f.created_at,f.engagement_fact_id returning engagement_fact_id
  )
  insert into public.nov_talent_recruiting_engagement_audit_v1(engagement_fact_id,event_type,actor_employee_id,actor_role)
  select engagement_fact_id,'CANCELLATION_APPENDED',p_actor_employee_id,p_actor_role from inserted;
  get diagnostics v_count=row_count;
  if v_count<>15 then raise exception using errcode='40001',message='SALON_VISIT_BACKFILL_VOID_ATOMIC_COUNT_MISMATCH'; end if;
  insert into public.nov_talent_recruiting_salon_visit_backfill_receipts_v1(
    backfill_code,receipt_state,review_status,review_package_sha256,canonical_source_sha256,
    source_event_count,unique_candidate_count,fact_count,original_actor_status,
    supersedes_receipt_id,actor_employee_id,actor_role,reason
  ) values('SALON_VISIT_2027_HUMAN_REVIEW','VOIDED','APPROVED_FOR_BACKFILL',
    v_completed.review_package_sha256,v_completed.canonical_source_sha256,4,4,15,'UNAVAILABLE',
    p_completed_receipt_id,p_actor_employee_id,p_actor_role,btrim(p_reason))
  returning backfill_receipt_id into v_receipt;
  return query select v_receipt,v_count;
end
$function$;

alter table public.nov_talent_recruiting_salon_visit_backfill_receipts_v1 enable row level security;
alter table public.nov_talent_recruiting_salon_visit_backfill_receipts_v1 force row level security;
revoke all on public.nov_talent_recruiting_salon_visit_backfill_receipts_v1 from public,anon,authenticated,service_role;
grant select on public.nov_talent_recruiting_salon_visit_backfill_receipts_v1 to service_role;

revoke all on function nov_talent_internal.salon_visit_2027_human_review_mappings_v1(),
  nov_talent_internal.salon_visit_2027_backfill_state_v1(),
  public.nov_talent_preflight_salon_visit_2027_backfill_v1(),
  public.nov_talent_execute_salon_visit_2027_backfill_v1(uuid,text,text,text),
  public.nov_talent_void_salon_visit_2027_backfill_v1(uuid,text,uuid,text)
from public,anon,authenticated,service_role;
grant execute on function public.nov_talent_preflight_salon_visit_2027_backfill_v1(),
  public.nov_talent_execute_salon_visit_2027_backfill_v1(uuid,text,text,text),
  public.nov_talent_void_salon_visit_2027_backfill_v1(uuid,text,uuid,text)
to service_role;

comment on column public.nov_talent_recruiting_engagement_facts_v1.source_event_id is
  'Optional canonical link to the reviewed recruitment source event; multiple store visits may share one source event.';
comment on function public.nov_talent_void_salon_visit_2027_backfill_v1(uuid,text,uuid,text) is
  'Append-only void procedure; requires a separate Owner gate and has no browser route.';

commit;

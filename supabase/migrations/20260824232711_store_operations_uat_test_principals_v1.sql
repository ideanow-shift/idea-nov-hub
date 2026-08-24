-- Store Operations controlled UAT test principals V1.
-- Staging-only expansion. Existing V1 history and Executive binding remain unchanged.

begin;

alter table store_operations_uat_private.external_subject_enrollment_challenges
  drop constraint external_subject_enrollment_challenges_identity_key_check,
  drop constraint external_subject_enrollment_challenges_approval_reference_check;
alter table store_operations_uat_private.external_subject_enrollment_challenges
  add constraint external_subject_enrollment_challenges_identity_key_check
    check (identity_key in ('uat-executive','uat-area-manager','uat-store-manager')),
  add constraint external_subject_enrollment_challenges_approval_reference_check
    check (approval_reference in (
      'approval:OWNER-STORE-OPS-UAT-WAKITA-FIREBASE-BINDING-2026-08-24-V1',
      'approval:OWNER-STORE-OPS-UAT-TEST-PRINCIPALS-2026-08-25-V1'
    ));

alter table store_operations_uat_private.external_subject_binding_decisions
  drop constraint external_subject_binding_decisions_evidence_reference_check;
alter table store_operations_uat_private.external_subject_binding_decisions
  add constraint external_subject_binding_decisions_evidence_reference_check
    check (evidence_reference in (
      'approval:OWNER-STORE-OPS-UAT-WAKITA-FIREBASE-BINDING-2026-08-24-V1',
      'approval:OWNER-STORE-OPS-UAT-TEST-PRINCIPALS-2026-08-25-V1'
    ));

create function public.store_operations_external_enrollment_issue_v2(
  p_challenge_hash text,p_artifact_digest text,p_identity_key text,p_expires_at timestamptz
) returns jsonb language plpgsql security definer set search_path=''
as $function$
declare approved store_operations_uat_private.approved_identities%rowtype; access jsonb;
  expected_role text; expected_mode text; expected_count integer; actual_store uuid;
begin
  if current_setting('role',true)<>'service_role' then raise exception 'STORE_OPERATIONS_UAT_SERVER_ONLY'; end if;
  if p_challenge_hash !~ '^[0-9a-f]{64}$'
    or p_identity_key not in ('uat-executive','uat-area-manager','uat-store-manager')
    or p_expires_at<=statement_timestamp() or p_expires_at>statement_timestamp()+interval '10 minutes'
  then raise exception 'STORE_OPERATIONS_EXTERNAL_CHALLENGE_INVALID'; end if;
  select * into approved from store_operations_uat_private.approved_identities
    where artifact_digest=p_artifact_digest and identity_key=p_identity_key
      and status='approved' and effective_from<=current_date and (effective_to is null or current_date<effective_to);
  if not found then raise exception 'STORE_OPERATIONS_UAT_IDENTITY_NOT_APPROVED'; end if;
  select case p_identity_key when 'uat-executive' then 'executive' when 'uat-area-manager' then 'area_manager'
    when 'uat-store-manager' then 'store_manager' end,
    case p_identity_key when 'uat-executive' then 'all' when 'uat-area-manager' then 'assigned'
    when 'uat-store-manager' then 'own' end,
    case p_identity_key when 'uat-executive' then 20 else 1 end
    into expected_role,expected_mode,expected_count;
  if approved.role_key<>expected_role then raise exception 'STORE_OPERATIONS_UAT_IDENTITY_NOT_APPROVED'; end if;
  access:=public.store_operations_uat_resolve_hub_employee_access_v1(approved.employee_id,current_date);
  if access->>'employeeId'<>approved.employee_id::text or access#>>'{roleKeys,0}'<>expected_role
    or jsonb_array_length(access->'roleKeys')<>1 or access#>>'{scope,mode}'<>expected_mode
    or jsonb_array_length(access#>'{scope,storeIds}')<>expected_count
  then raise exception 'STORE_OPERATIONS_UAT_SCOPE_DENIED'; end if;
  if expected_count=1 then
    actual_store:=(access#>>'{scope,storeIds,0}')::uuid;
    if approved.expected_store_id is null or actual_store<>approved.expected_store_id
    then raise exception 'STORE_OPERATIONS_UAT_SCOPE_DENIED'; end if;
  elsif approved.expected_store_id is not null then raise exception 'STORE_OPERATIONS_UAT_SCOPE_DENIED'; end if;
  insert into store_operations_uat_private.external_subject_enrollment_challenges(
    challenge_hash,artifact_digest,identity_key,employee_id,approval_reference,expires_at
  ) values(p_challenge_hash,p_artifact_digest,p_identity_key,approved.employee_id,
    'approval:OWNER-STORE-OPS-UAT-TEST-PRINCIPALS-2026-08-25-V1',p_expires_at);
  return jsonb_build_object('issued',true,'identityKey',p_identity_key,'expiresAt',p_expires_at);
end
$function$;

create function public.store_operations_external_enrollment_consume_v2(
  p_challenge_hash text,p_expected_identity_key text,p_provider text,p_issuer text,p_audience text,
  p_subject_fingerprint text,p_fingerprint_key_version integer,p_request_id uuid,p_effective_to timestamptz
) returns jsonb language plpgsql security definer set search_path=''
as $function$
declare challenge store_operations_uat_private.external_subject_enrollment_challenges%rowtype;
  approved store_operations_uat_private.approved_identities%rowtype; access jsonb;
  binding_key_value uuid:=gen_random_uuid(); consumed_at_value timestamptz:=statement_timestamp();
  expected_role text; expected_mode text; expected_count integer; actual_store uuid;
begin
  if current_setting('role',true)<>'service_role' then raise exception 'STORE_OPERATIONS_UAT_SERVER_ONLY'; end if;
  if p_expected_identity_key not in ('uat-executive','uat-area-manager','uat-store-manager')
    or p_provider<>'google.com' or p_issuer<>'https://securetoken.google.com/idea-nov-group-portal'
    or p_audience<>'idea-nov-group-portal' or p_subject_fingerprint !~ '^[0-9a-f]{64}$'
    or p_fingerprint_key_version<>1 or p_request_id is null or p_effective_to<=consumed_at_value
    or p_effective_to>consumed_at_value+interval '14 days'
  then raise exception 'STORE_OPERATIONS_EXTERNAL_BINDING_INVALID'; end if;
  update store_operations_uat_private.external_subject_enrollment_challenges
    set consumed_at=consumed_at_value,request_id=p_request_id
    where challenge_hash=p_challenge_hash and identity_key=p_expected_identity_key and consumed_at is null
      and expires_at>consumed_at_value
    returning * into challenge;
  if not found then raise exception 'STORE_OPERATIONS_EXTERNAL_CHALLENGE_DENIED'; end if;
  select * into approved from store_operations_uat_private.approved_identities
    where artifact_digest=challenge.artifact_digest and identity_key=challenge.identity_key
      and employee_id=challenge.employee_id and status='approved' and effective_from<=current_date
      and (effective_to is null or current_date<effective_to);
  if not found then raise exception 'STORE_OPERATIONS_UAT_IDENTITY_NOT_APPROVED'; end if;
  select case p_expected_identity_key when 'uat-executive' then 'executive' when 'uat-area-manager' then 'area_manager'
    when 'uat-store-manager' then 'store_manager' end,
    case p_expected_identity_key when 'uat-executive' then 'all' when 'uat-area-manager' then 'assigned'
    when 'uat-store-manager' then 'own' end,
    case p_expected_identity_key when 'uat-executive' then 20 else 1 end
    into expected_role,expected_mode,expected_count;
  if approved.role_key<>expected_role then raise exception 'STORE_OPERATIONS_UAT_IDENTITY_NOT_APPROVED'; end if;
  access:=public.store_operations_uat_resolve_hub_employee_access_v1(challenge.employee_id,current_date);
  if access->>'employeeId'<>challenge.employee_id::text or access#>>'{roleKeys,0}'<>expected_role
    or jsonb_array_length(access->'roleKeys')<>1 or access#>>'{scope,mode}'<>expected_mode
    or jsonb_array_length(access#>'{scope,storeIds}')<>expected_count
  then raise exception 'STORE_OPERATIONS_UAT_SCOPE_DENIED'; end if;
  if expected_count=1 then
    actual_store:=(access#>>'{scope,storeIds,0}')::uuid;
    if approved.expected_store_id is null or actual_store<>approved.expected_store_id
    then raise exception 'STORE_OPERATIONS_UAT_SCOPE_DENIED'; end if;
  elsif approved.expected_store_id is not null then raise exception 'STORE_OPERATIONS_UAT_SCOPE_DENIED'; end if;
  insert into store_operations_uat_private.external_subject_binding_decisions(
    binding_key,decision_sequence,provider,issuer,audience,subject_fingerprint,fingerprint_key_version,
    employee_id,decision,effective_at,effective_to,evidence_reference,enrollment_challenge_id
  ) values(binding_key_value,1,p_provider,p_issuer,p_audience,p_subject_fingerprint,p_fingerprint_key_version,
    challenge.employee_id,'grant',consumed_at_value,p_effective_to,
    'approval:OWNER-STORE-OPS-UAT-TEST-PRINCIPALS-2026-08-25-V1',challenge.challenge_id);
  return jsonb_build_object('bound',true,'identityKey',p_expected_identity_key,'employeeId',challenge.employee_id,'access',access);
end
$function$;

revoke all on function public.store_operations_external_enrollment_issue_v1(text,text,text,timestamptz)
  from public,anon,authenticated,service_role;
revoke all on function public.store_operations_external_enrollment_consume_v1(text,text,text,text,text,integer,uuid,timestamptz)
  from public,anon,authenticated,service_role;
revoke all on function public.store_operations_external_enrollment_issue_v2(text,text,text,timestamptz)
  from public,anon,authenticated;
revoke all on function public.store_operations_external_enrollment_consume_v2(text,text,text,text,text,text,integer,uuid,timestamptz)
  from public,anon,authenticated;
grant execute on function public.store_operations_external_enrollment_issue_v2(text,text,text,timestamptz) to service_role;
grant execute on function public.store_operations_external_enrollment_consume_v2(text,text,text,text,text,text,integer,uuid,timestamptz) to service_role;

commit;

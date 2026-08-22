create function public.store_operations_uat_register_auth_v2(
  p_artifact_digest text,p_identity_key text,p_delivery_digest text,p_auth_subject uuid
) returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare
  approved store_operations_uat_private.approved_identities%rowtype;
  corporation_id_value uuid;
  scope_type_value text;
  store_id_value uuid;
  binding_key_value uuid := gen_random_uuid();
  attestation_key_value uuid := gen_random_uuid();
  scenario text;
begin
  if coalesce(pg_catalog.current_setting('request.jwt.claim.role',true),'')<>'service_role' then
    raise exception 'STORE_OPERATIONS_UAT_SERVER_ONLY';
  end if;
  if not exists(select 1 from auth.users where id=p_auth_subject and deleted_at is null
    and (banned_until is null or banned_until<=statement_timestamp())) then
    raise exception 'STORE_OPERATIONS_UAT_AUTH_SUBJECT_INACTIVE';
  end if;
  select * into approved from store_operations_uat_private.approved_identities
    where artifact_digest=p_artifact_digest and identity_key=p_identity_key
      and delivery_digest=p_delivery_digest and status='approved'
      and effective_from<=current_date and (effective_to is null or current_date<effective_to);
  if not found then raise exception 'STORE_OPERATIONS_UAT_IDENTITY_NOT_APPROVED'; end if;
  if exists(select 1 from store_operations_uat_private.auth_identity_binding_decisions
    where (auth_subject_id=p_auth_subject or employee_id=approved.employee_id) and decision='grant') then
    raise exception 'STORE_OPERATIONS_UAT_BINDING_ALREADY_EXISTS';
  end if;
  select r.corporation_id,a.store_id into corporation_id_value,store_id_value
  from core.employee_store_assignments a
  join core.assignment_identities ai on ai.assignment_id=a.assignment_id and ai.identity_status='active'
  join core.corporation_store_relationships r on r.store_id=a.store_id and r.relationship_type='accounting'
  where a.assignment_version_id=approved.assignment_version_id and a.employee_id=approved.employee_id
    and a.status='active' and a.effective_from<=current_date
    and (a.effective_to is null or current_date<a.effective_to)
    and r.effective_from<=current_date and (r.effective_to is null or current_date<r.effective_to)
  limit 1;
  if corporation_id_value is null then raise exception 'STORE_OPERATIONS_UAT_ASSIGNMENT_INACTIVE'; end if;
  scope_type_value := case when approved.role_key='executive' then 'corporation' else 'store' end;
  insert into store_operations_uat_private.auth_identity_binding_decisions(
    binding_key,decision_sequence,auth_subject_id,artifact_digest,identity_key,employee_id,decision,effective_at,evidence_reference
  ) values(binding_key_value,1,p_auth_subject,p_artifact_digest,p_identity_key,approved.employee_id,'grant',statement_timestamp(),'artifact:'||p_artifact_digest);
  insert into store_operations_uat_private.role_attestation_decisions(
    attestation_key,decision_sequence,auth_subject_id,employee_id,role_key,audience,decision,effective_at,evidence_reference
  ) values(attestation_key_value,1,p_auth_subject,approved.employee_id,approved.role_key,'store_operations_staging_v1','grant',statement_timestamp(),'artifact:'||p_artifact_digest);
  foreach scenario in array array['actual','budget'] loop
    insert into accounting.consumer_access_contracts(
      access_key,decision_sequence,auth_subject_id,employee_id,assignment_version_id,scope_type,
      corporation_id,store_id,scenario_type,decision,effective_at,evidence_reference,contract_version
    ) values(gen_random_uuid(),1,p_auth_subject,approved.employee_id,approved.assignment_version_id,
      scope_type_value,corporation_id_value,case when scope_type_value='store' then store_id_value else null end,
      scenario,'grant',statement_timestamp(),'approval:PR-179','store_operations_uat_v1');
  end loop;
  return jsonb_build_object('registered',true,'role',approved.role_key);
end
$function$;

revoke all on function public.store_operations_uat_register_auth_v2(text,text,text,uuid)
  from public,anon,authenticated;
grant execute on function public.store_operations_uat_register_auth_v2(text,text,text,uuid) to service_role;
comment on function public.store_operations_uat_register_auth_v2(text,text,text,uuid) is
  'Staging UAT server-only exact identity binding; delivery digest must match the sealed artifact.';

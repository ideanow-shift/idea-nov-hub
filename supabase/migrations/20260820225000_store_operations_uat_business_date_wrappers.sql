create function public.store_operations_uat_register_auth_v3(
  p_artifact_digest text,p_identity_key text,p_delivery_digest text,p_auth_subject uuid
) returns jsonb
language plpgsql security definer set search_path=''
as $function$
begin
  perform pg_catalog.set_config('TimeZone','Asia/Tokyo',true);
  return public.store_operations_uat_register_auth_v2(
    p_artifact_digest,p_identity_key,p_delivery_digest,p_auth_subject
  );
end
$function$;

create function public.store_operations_uat_resolve_access_v2(p_auth_subject uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $function$
begin
  perform pg_catalog.set_config('TimeZone','Asia/Tokyo',true);
  return public.store_operations_uat_resolve_access_v1(p_auth_subject,current_date);
end
$function$;

revoke all on function public.store_operations_uat_register_auth_v3(text,text,text,uuid)
  from public,anon,authenticated;
revoke all on function public.store_operations_uat_resolve_access_v2(uuid)
  from public,anon,authenticated;
grant execute on function public.store_operations_uat_register_auth_v3(text,text,text,uuid) to service_role;
grant execute on function public.store_operations_uat_resolve_access_v2(uuid) to service_role;

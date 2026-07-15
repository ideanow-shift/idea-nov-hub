-- SOURCE CANDIDATE ONLY. DO NOT EXECUTE.
-- RUNTIME-DISCONNECTED BOUNDARY: provider must remain unwired and ungranted.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

revoke all on function public.resolve_finance_classification_source_ownership(uuid)
  from public, anon, authenticated, classification_source_ownership_provider_owner;
drop function public.resolve_finance_classification_source_ownership(uuid);

revoke all on function public.read_finance_classification_source_ownership_provider_status()
  from public, anon, authenticated, classification_source_ownership_provider_owner;
drop function public.read_finance_classification_source_ownership_provider_status();

drop role classification_source_ownership_provider_owner;
commit;

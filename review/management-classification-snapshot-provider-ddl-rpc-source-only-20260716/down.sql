-- SOURCE CANDIDATE ONLY. DO NOT EXECUTE.
-- DATA-LOSS BOUNDARY: export snapshot identities and approve restore first.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

revoke all on function public.derive_finance_classification_snapshot(uuid)
  from public, anon, authenticated, classification_snapshot_provider_owner;
drop function public.derive_finance_classification_snapshot(uuid);

revoke all on function public.read_finance_classification_snapshot_provider_status()
  from public, anon, authenticated, classification_snapshot_provider_owner;
drop function public.read_finance_classification_snapshot_provider_status();

alter table public.finance_account_classification_rules
  drop constraint finance_account_classification_rules_snapshot_format,
  drop column classification_snapshot;

drop role classification_snapshot_provider_owner;
commit;


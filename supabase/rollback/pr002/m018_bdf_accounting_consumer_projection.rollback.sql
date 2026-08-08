-- M018-only rollback. M017 and all earlier objects remain intact.

drop view projection.accounting_cash_flow_v1;
drop view projection.accounting_corporation_comparison_v1;
drop view projection.accounting_store_profit_v1;
drop view projection.accounting_corporation_bs_v1;
drop view projection.accounting_corporation_pl_v1;
drop view projection.accounting_publication_status_v1;
drop function projection.m018_current_published_lines();

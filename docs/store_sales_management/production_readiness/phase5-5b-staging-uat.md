# Phase 5-5B Staging UAT

## Evidence Template

| Case ID | Actor | Scenario | Expected | Actual | Evidence path | Tester role | Status |
|---|---|---|---|---|---|---|---|
| UAT-STG-001 | representative_director | HUB/direct URL/all stores | 19 active synthetic stores | TBD | TBD | UAT Owner | proposed |
| UAT-STG-002 | store_manager | own store/profit/detail/mobile | 1 store、他店導線なし | TBD | TBD | UAT Owner | proposed |
| UAT-STG-003 | franchise_owner | own FC/cross FC | own company only、cross 403 | TBD | TBD | FC Representative | proposed |
| UAT-STG-004 | employee | card/direct URL | hidden/403 | TBD | TBD | Security Owner | proposed |
| UAT-STG-005 | all | collecting/preparing/validation | distinct state、value hidden | TBD | TBD | Accounting Owner | proposed |
| UAT-STG-006 | all | timeout/maintenance/retry | Runtime state and retry | TBD | TBD | Platform Owner | proposed |
| UAT-STG-007 | all | mobile/keyboard/ARIA | operable and labeled | TBD | TBD | UAT Owner | proposed |

対象にはdirector、executive、department manager、logout、expired session、売上、利益、利益率、確定月、Actions、Drivers、List、Detail、offline、rollback後を追加する。

Synthetic screenshotは`docs/store_sales_management/production_readiness/screenshots/`へ保存する。

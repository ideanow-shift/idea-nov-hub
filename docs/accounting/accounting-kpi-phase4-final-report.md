# Accounting KPI Engine Phase 4 最終報告

## 結論

**Conditional Go（隔離prototype合格、本番移行は未承認）**

Accounting Coreを変更せず、active published projectionだけを読むKPI Engineに、
definition setの二段階承認・release、run/result supersede、idempotency、並行lock、
retry、rollback後の旧version除外、actor scope、consumer API、metadata-only CLIを
実装した。本番Supabase、DB、Storage、NOV HUB、IDEA LINKには接続していない。

本番移行には、経理・経営による正式definition/account group承認、RLSレビュー、
実データでのUAT、service role運用設計の承認が必要である。

## 正式KPIと表示

初期definition setは次の6 KPIを対象とする。

- gross_profit_margin
- operating_profit_margin
- ordinary_profit_margin
- net_profit_margin
- equity_ratio
- current_ratio

`equity_ratio = net_assets / total_assets`、`period_mode=point_in_time`、
`amount_basis=net`、`unit=percent`を維持する。内部値はDecimal ratioのまま保持し、
表示時だけ100倍して小数第1位へ`ROUND_HALF_UP`する。例としてraw `0.18456`は
`display_value=18.5`となる。

## Approval・release

checked-in Registryはproposedのままである。prototype DB上で
definition/account groupを明示承認した後、definition setを
`proposed -> accounting_approved -> management_approved -> released`と遷移させる。
経理レビュー、経営承認、releaseは別roleで、actor、時刻、理由をappend-only auditへ
記録する。未承認definition/account groupを含むsetはrelease不可である。

definitionとdefinition setのsupersedeは旧行を保持し、新versionから旧IDを参照する。
consumerはreleased setだけを利用する。

## Calculation run・result

runの一意性は次の組で管理する。

`accounting_version_id + definition_set_version + entity_id + scope_type +
target_period + amount_basis`

SQLiteではtransactionとpartial unique indexによりqueued/running/completedの重複を
拒否する。completed runは明示recalculateがない限り再利用する。PostgreSQL案では
同じunique indexと`pg_advisory_xact_lock`を併用する。

retryは失敗runを上書きせず、`retry_of_run_id`と増加するattemptを持つ新runを作る。
再計算、Accounting version変更、definition set変更は新run/resultを作り、旧run/resultを
supersededにする。rollback restore時は旧Accounting versionをinactiveとして観測し、
そのversion由来run/resultをactive projectionから除外する。

## Consumer projection・API

active consumer projectionは次をすべて満たす結果だけを返す。

- runがcompletedまたはcompleted_with_warnings
- definition setがreleased
- definitionがapproved
- Accounting versionがactive publishedとして観測済み
- resultがsupersededでない
- Core入力periodがconfirmedでcarry-forwardではない
- data_stateがavailable
- trusted server actorのscope内

店舗APIは自店舗のgross/operating/ordinary profit marginの3件だけを返す。
法人経営APIはexecutive/department等のtrusted scope内だけを返す。一般actorの
レスポンスにはfact ID、numerator/denominator金額を含めない。admin provenanceは
明示された管理roleだけに分離した。契約は
`docs/accounting/accounting-kpi-api-v1.yaml`に記録した。

## Actor scope・security negative test

要求された28 controlを実装・検証した。

1. employee拒否
2. store manager自店舗3 KPI許可
3. store manager他店舗拒否
4. department manager他部署拒否
5. franchise owner自FC scope許可
6. franchise owner他FC拒否
7. franchise owner本部・全社拒否
8. body entity差替え無効
9. role自己申告無効
10. scope自己申告無効
11. unreleased set非公開
12. proposed definition非公開
13. proposed group正式計算不可
14. failed run非公開
15. superseded run非公開
16. superseded result非公開
17. unpublished Accounting version計算不可
18. pending period計算不可
19. carry-forward使用不可
20. amount basis混在不可
21. leaf/summary二重計上不可
22. 一般actorへfact ID非公開
23. 一般actorへnumerator/denominator金額非公開
24. service role自己申告不可
25. Core fact更新・削除不可
26. definitionコード/SQL注入不可
27. 他scopeのrun/audit/provenance非公開
28. 同一keyの二重completed run不可

actorのrole、scope、entityはrequest bodyから解決せず、trusted server contextだけを使う。

## Provenance・CLI

管理者provenanceはdefinition version、run、Accounting version、account group、
input role、Core fact IDを追跡できる。一般actorには公開しない。
CLI reportはrun ID、version、scope、period、status、attempt、件数だけを返し、
金額・ratio・fact IDは返さない。

## PostgreSQL／Supabase review

`docs/accounting/accounting-kpi-postgresql-review.sql`にreview-only DDL/RLSを記録した。
結果、provenance、auditでRLSを有効化し、`auth.uid()`からserver-sideで解決する
scope関数を前提とする。result/provenance/auditのUPDATE/DELETE policyは作らない。
service roleはclientへ公開しない。これは本番へ適用していない。

## Import Profile

Import ProfileはAccounting Coreの責務とし、KPI EngineへExcel adapterを複製しない。
source構造変更は新Import ProfileとAccounting versionで吸収し、KPI側ではcanonical
account groupとimmutable versionだけを参照する。判断は
`docs/accounting/accounting-kpi-import-profile-adr.md`に記録した。

## テスト結果

- Phase 4 controls: 17/17 合格
- KPI Engine全体: 33/33 合格
- Accounting Core回帰: 28/28 合格
- Python自動テスト総計: **61/61 合格**
- security negative control: **28/28 合格**

実行コマンド:

`python -m unittest discover -s tests -t . -v`

## 残存blocking・Unknown・人間確認

- checked-in definition/account groupは意図どおりproposedであり、正式承認は未実施。
- 第11〜13期のalias/entity mapping候補も人間承認前であり、KPI release根拠にしない。
- 第13期2026-07はpending/carry-forward blockingのまま。計算・consumer公開しない。
- PostgreSQL関数`kpi_actor_can_access`等の実装とRLSはsecurity reviewが必要。
- 実際の法人・部署・店舗・FC階層を使うscope UATは未実施。
- 実Accounting versionとdefinition setのrelease orchestration結合は本番前に必要。
- 添付指示書は店舗API JSON例の途中で物理的に終了していたため、法人APIの詳細UI項目は
  既存Core境界と明示済み共通レスポンスを基準にした。追加契約がある場合は差分確認が必要。

## 本番移行可否

現時点では**不可**。隔離prototypeとしてはGo。本番移行には上記人間確認、RLS review、
UAT、正式release、運用runbook承認が必要である。

## 変更ファイル

- `accounting_kpi/domain.py`
- `accounting_kpi/repository.py`
- `accounting_kpi/schema.sql`
- `accounting_kpi/workflow.py`
- `accounting_kpi/cli.py`
- `accounting_kpi/consumer.py`
- `accounting_kpi/lifecycle.py`
- `tests/accounting_kpi/test_phase4_controls.py`
- `docs/accounting/accounting-kpi-api-v1.yaml`
- `docs/accounting/accounting-kpi-import-profile-adr.md`
- `docs/accounting/accounting-kpi-postgresql-review.sql`
- `docs/accounting/accounting-kpi-phase4-final-report.md`

ブランチ: `feat/accounting-kpi-engine-phase4-prototype`

基準コミット: `335d63b5639bf1bb0b38ec129482a4cd0d029846`

実装コミット: 本報告を含むdelivery commit（最終応答のcommit hashを正とする）

Draft PR: 未作成（本turnではpush/PR作成の指示なし）

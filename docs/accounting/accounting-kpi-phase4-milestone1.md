# Accounting KPI Engine Phase 4 — 中間マイルストーン1

## 実装済み範囲

- KPI domain modelと状態
- 宣言的JSON Definition Registry（20 definitions、すべてproposed）
- account group model（正式6KPI向け9 groups、すべてproposed）
- 8テーブルの隔離SQLite schema
- Accounting Core published projection read-only adapter
- Decimalによる正式候補6KPI calculator
- definition／account group明示承認とaudit
- confirmed period、published、active version、carry-forward gate
- 欠損、分母0、負数、amount basis不一致処理
- calculation run、result、input provenance保存
- rollback_restore versionの新runと旧result保持
- synthetic tests

actor scope、security negative test、consumer API、RLS、CLIは次マイルストーン
まで実装しない。

## 6KPI synthetic計算結果

synthetic入力は売上1,000、粗利400、営業利益200、経常利益180、当期利益120、
総資産2,000、純資産800、流動資産900、流動負債600（単位非公開fixture）。

| KPI | 内部ratio | data state |
|---|---:|---|
| gross_profit_margin | 0.40 | available |
| operating_profit_margin | 0.20 | available |
| ordinary_profit_margin | 0.18 | available |
| net_profit_margin | 0.12 | available |
| equity_ratio | 0.40 | available |
| current_ratio | 1.50 | available |

浮動小数点を使用せずDecimalで保持する。表示桁は未承認。

## Test

- KPI Engine tests: 16/16 pass
- Accounting Core regression: 28/28 pass
- Total: 44/44 pass

検証項目は正常6KPI、未承認definition/group、分母0、欠損、負分母、
未確定／carry-forward、unpublished／superseded、rollback restore、旧結果、
provenance、宣言式code injection、leaf/summary分離、amount basis、第11〜13期
有効期間、Core read-only。

## Definition・Account group状態

checked-in Registryはdefinition 20件、account group 9件すべて`proposed`。
テスト内で管理者承認操作を実行した場合のみ正式6KPIと必要groupをapprovedに
し、6件をavailableとして保存した。未承認状態では`value=null`、
`data_state=preparing`、`DEFINITION_NOT_APPROVED`または
`ACCOUNT_GROUP_NOT_APPROVED`となる。

## Data state

正常run: available 6、preparing 0、unavailable 0、validation_error 0。

異常fixtureで、definition/group未承認と欠損はpreparing、分母0は
unavailable、負分母とamount basis不一致はvalidation_errorになることを確認。
暗黙の0、NaN、Infinityは保存しない。

## Provenance

各直接ratio resultからdefinition version、calculation run、numerator／
denominator group、Accounting fact ID、Accounting version、scopeへ追跡した。
各KPIでnumeratorとdenominatorの最低2 input rowを保持する。金額は通常
provenance queryへ含めない。

## 設計変更点

- 事前計算resultを正本とし、previewだけ動的計算可能
- expressionはallowlist operatorを持つJSON tree
- EngineからAccounting Coreへのmutation APIを提供しない
- Core adapterはpublished・両承認・cutoff以前・confirmed・non-carry・active
  projectionをすべて再検証
- legal entity専用KPIをscope definitionで制限
- definition／groupはimmutable IDとversion、有効期間、supersedesを保持

## 追加Unknown

- 正式なKPI definition／account group承認者
- 百分率表示桁とrounding rule
- Core consumer projectionのproduction interface
- account group canonical account IDのDB正本
- definition set単位の承認・release方式
- calculation run retry／idempotency／並行実行lock
- rollback時の旧run active状態管理
- Import Profile schema signatureの正本

## 次に実装する内容

- server-side actor scope
- security negative tests
- approved resultだけのactive consumer projection
- 店舗／法人API契約
- metadata-only CLI
- PostgreSQL／Supabase review DDL・RLS
- admin provenance view
- definition version／result supersedeの仕上げ
- Import Profile ADR

## 変更ファイル

- `accounting_kpi/__init__.py`
- `accounting_kpi/domain.py`
- `accounting_kpi/registry.py`
- `accounting_kpi/core_adapter.py`
- `accounting_kpi/calculator.py`
- `accounting_kpi/repository.py`
- `accounting_kpi/workflow.py`
- `accounting_kpi/schema.sql`
- `docs/accounting/accounting-kpi-definition-registry.json`
- `docs/accounting/accounting-kpi-account-groups.json`
- `tests/accounting_kpi/test_kpi_engine.py`

本番接続・migration・原本Excel追加は行っていない。

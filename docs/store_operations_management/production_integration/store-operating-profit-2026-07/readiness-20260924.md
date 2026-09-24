# 2026年7月 店舗営業利益 Production投入前レディネス

## Portfolio gate

- `LOCK_ID`: `CTO-PORTFOLIO-EXECUTION-ORDER-2026-08-22-V4`
- `CURRENT_PHASE`: `PHASE_3_STORE_OPERATIONS_MANAGEMENT_V1`
- Store Operations: 実装・検証可
- Corporate Management: Phase 4開始前のため、新規DB/UI実装は行わない

## 目的

会計正本に確定済みの2026年7月店舗営業利益を、既存のDBF Store Fact契約へ
append-onlyで投入できる固定パッケージとして準備する。Productionへの実行は、
PR merge後の確定main SHAと実行SQL SHAを指定したOwner別承認まで行わない。

## 固定入力

- ファイル: `会計_法人管理正本.xlsx`
- SHA-256: `97E5F6E360DFCD00CE6E69F974C1E9F19BC8EFFE8B89684FD290946D8872485D`
- byte size: `4,012,486`
- 対象sheet: `13_PL_ENTITY_SUMMARY`
- 明細検算sheet: `12_PL_ENTITY_MONTHLY`
- 対象月: `2026-07`
- 2026年7月明細: `3,382`行
- 税区分: 税抜
- source verification status: `PASS_CURRENT_ONLY`

## 店舗境界

- 直営13店舗: canonical昇格対象
- FC移管済み5店舗: 正本上の0円行を出典として保持し、Store Factへは昇格しない
  - 久米川
  - 国分寺
  - 新所沢
  - 東久留米
  - 花小金井
- fuzzy mapping: 0件
- 既存Production mapping再利用: company 1件 + store 13件
- 新規mapping作成予定: 0件

## Production read-only baseline（2026-09-24）

- active actor: 1件
- `OPERATING_PROFIT / v1 / amount` definition: 1件
- company mapping一致: 1件
- direct store mapping + active master一致: 13件
- 2026年7月 active `OPERATING_PROFIT`: 0件
- 固定入力SHAのsource file: 0件

## 固定生成物

- package SHA-256: `10F012FDFA51303B3C68DDC7ACB9B854A85630DCC2DA423B16557966B4E0B7B3`
- package file SHA-256: `8823AEFD8AE78867F96B56C7C32CF720BB26BF71A4A61645C37B943248045BA7`
- execution SQL SHA-256: `0EC148BBB4477563B5F1ACC33FDA1D56EC70B0F9121165F01D6B5BF5776BCB8E`
- request fingerprint: `4DDE38C734D36C60E20B4D70D847DB13BB6B229F4B05C050506853CC3E0F88E8`

## Production予定

- DDL: 0件
- source file: 1件
- import batch: 1件
- raw rows: 13件
- staging rows: 13件
- import events: 4件
- canonical facts: 13件
- batch status updates: 2件
- 既存Fact直接更新: 0件
- delete: 0件

SQLは外部Owner承認設定がない場合に`OWNER_APPROVAL_GATE_REQUIRED`で停止する。
実行時もmetric definition、actor、company/store master、既存mapping、July重複、
固定source/package重複を再検証し、13件・合計11,077,247円のread-back不一致時は
transaction全体をrollbackする。

## 法人経営管理への引継ぎ

同一正本には6法人分の法人別P/Lが含まれる。現在はPortfolio Lockにより
Corporate ManagementのDB/UI実装を開始せず、正本SHA・法人別sheet・検算情報を
Phase 4引継ぎ入力として固定する。Phase 3 exitとOwner承認済み
`[OWNER PHASE TRANSITION]` PRのmerge後に、法人スコープFact・読取投影・UIを設計する。

## このPRで行わないこと

- Production DB DDL/DML
- Staging/Production deploy
- 実データ変更
- PR merge
- Corporate Managementの先行実装

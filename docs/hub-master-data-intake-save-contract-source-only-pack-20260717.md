# HUB Master Data Intake save contract source-only pack 2026-07-17

## Decision

社員・店舗・法人CSVの保存境界をsource-only候補として固定した。master-adminの保存ボタン、API action、DB/RPCは変更していない。

```yaml
status: SOURCE_ONLY_CANDIDATE
production_save_enabled: false
database_mutation: false
runtime_changed: false
```

## Current source facts

- 現行UIはUTF-8 CSVのヘッダー、必須値、ファイル内重複キーを検証する。
- previewは新規、更新、変更なし、エラー件数を表示する。
- 現行の同一ファイル判定はtarget、file name、size、lastModifiedのブラウザ内signatureであり、保存時のidempotency正本にはできない。
- preview結果には保存用のcanonical valuesを保持していない。保存実装時は再parseし、fileDigestとpreviewDigestを再検証する必要がある。
- 保存ボタンは`保存基盤レビュー待ち`でdisabledのままである。

## Proposed API contract

```yaml
action: masterCommitDataIntake
targets: [employees, stores, corporations]
clientRequestId: UUID
fileDigest: SHA-256 lowercase hex64
previewDigest: canonical changed rows SHA-256 lowercase hex64
maxRows: 1000
commit: all-or-nothing
partialSave: prohibited
```

送信対象はcreate/update行だけとし、preview集計との一致をbackendで検証する。optional項目の空欄はPhase 1では`変更しない`とする。明示的な値消去は別の製品判断とする。

## Forbidden CSV fields

- PIN、password、credential、Firebase UID
- LINE WORKS通知先ID、通知設定
- roleKeys、permission、actor override
- profile image、Storage path
- マイナンバー、給与、口座等のHR private項目

これらは社員CSVへ混在させず、それぞれの専用管理境界を使用する。

## Required backend boundary

1. HUB session/Firebase tokenを検証する。
2. `public.employees`の現職・login有効を再確認する。
3. `super_admin`または正式なmaster editor権限をDB正本から再確認する。
4. target、digest、counts、rows、field allowlistを再検証する。
5. target + fileDigestとclientRequestIdをidempotency正本へ記録する。
6. 全行更新と変更履歴を単一transaction/RPCで完了する。
7. 1行でも解決不能、競合、保存失敗なら全体rollbackする。
8. レスポンスは件数と固定categoryのみとし、raw rowや個人値を返さない。

店舗の法人解決、社員の所属解決はserver側で正本IDへ変換する。曖昧・欠落時はbatch全体をfail-closeする。clientからDB UUIDを正本として受け取らない。

## Source candidate

- `review/master-data-intake-save-contract-source-only-20260717/master-data-intake-save-contract-candidate.mjs`
- `review/master-data-intake-save-contract-source-only-20260717/fixtures.mjs`

Fixtureは3 target、invalid UUID/digest、preview error、count mismatch、duplicate key、禁止項目、unknown field、no-op、safe replay、request ID再利用、同一file再取込を確認する。

## Next gate

Core DB reviewで以下を確定するまでproduction保存はHOLDとする。

- transactional RPC/table ownership
- idempotency tableとretention
- RLS/GRANT、service_role境界
- change log row shape
- create/update時のnatural key解決と競合規則
- optional blankのclear semantics

DDL/RPC/RLS/GRANT、Edge deploy、frontend保存有効化、production data intakeはすべて別gateである。

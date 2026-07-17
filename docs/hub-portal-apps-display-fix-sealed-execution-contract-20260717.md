# HUB portal_apps 表示整理 sealed execution contract 2026-07-17

> **SUPERSEDED 2026-07-18 / DO NOT EXECUTE.** Historical evidence only. The
> sealed SQL, rollback, validator, and runner were retired by
> `hub-portal-apps-zero-gas-supersession-20260718.md`.

## 判定状態

```yaml
sealed_execution_contract: source_static_complete
production_dml: not_executed
rollback_execution: separate_gate_required
production_mutation_count: 0
```

## authoritative evidence

### DB schema

- source: `supabase/portal-apps.sql`
- SHA-256: `9407EA08199EBD8D0FA87F9900F019456365E8109D9360A470946AEC916A1240`
- `app_id` はunique。
- 対象columnは `url`, `is_active`, `is_featured`, `updated_at`。

### production current values

2026-07-17のproduction SELECT-only snapshotをruntime authoritative
evidenceとする。

- evidence: `docs/hub-portal-apps-display-audit-20260717.md`
- SHA-256: `827AF99DD56B9D5D344F9AD935593EA671F822AF85395E43A66E46CF773CAAB0`
- `EDU`: 1件、active / featured、旧GAS URL、priority 2。
- `THANKS`: 1件、active / featured、旧GAS URL、priority 1。
- `idea-link`: 1件、active / not featured、`./idea-link-app/`、priority 88。

行ID、個人値、token、Secretは記録していない。

### EDU update destination

更新先URLのauthoritative frontend source:

- `portal/js/main.js:43`
  - SHA-256: `773A664A52021BEA64DD25E2482A0EF664CA470D2BBBFB24EDB53137E3D933F1`
- `portal/js/apps.js:10`
  - SHA-256: `746AFD8C91DDF680F7D6D072C5C6FF1443134301EFEB83210D1BC319354C9345`

更新先:

`https://script.google.com/macros/s/AKfycbxKLThF4TN18-OwaOFKbqwoPPSAHB7HH4v3_IkTXEmAGrhDJyzS1GfkfC1GFGiA7vUZew/exec?page=home`

## sealed SQL

- source: `supabase/portal-apps-display-fix-sealed-20260717.sql`
- normalized LF SHA-256:
  `9E5F6C6BFD093775ABA00DB8C27648B5862F7F975C99934A94E61BEED5524EC9`
- exact UPDATE:
  - `EDU`: `url`, `updated_at`
  - `THANKS`: `is_active`, `is_featured`, `updated_at`
- transaction: `BEGIN` / `COMMIT`
- `statement_timeout`: 15秒
- `lock_timeout`: 5秒
- `idle_in_transaction_session_timeout`: 20秒
- maximum updated rows: 2
- expected row count:
  - `EDU = 1`
  - `THANKS = 1`
  - total = 2

旧 `supabase/portal-apps-display-fix-candidate-20260717.sql`
はunsealed候補としてsuperseded扱いとし、production execution inputから除外する。

## fail-close contract

更新前に `EDU`, `THANKS`, `idea-link` を `FOR UPDATE`
で固定し、次を完全一致確認する。

- 3 app_idが各1件。
- app_name、URL、category、active、featured、priorityがsnapshotと一致。
- 1項目でも不一致ならdivision
  guardでstatementを失敗させ、transaction全体をabort。
- 更新件数が各1件、合計2件でなければpostcondition guardでabort。
- `idea-link` はUPDATE文の対象外。
- `portal_apps`の他行はUPDATE文の対象外。
- INSERT / DELETE / DDL / RLS / GRANT / RPCは含まない。

## sealed executor

- source: `tools/run_portal_apps_display_fix_sealed_20260717.ps1`
- normalized LF SHA-256:
  `BE37E2BD44E5C8D46E95B65D257E70AC1E192B517163E68BB20E9A99250761BA`
- Supabase CLI exact version: `2.109.1`
- CLI command:
  `npx.cmd supabase db query --linked --output-format json --file ... --workdir ...`
- production target identity:
  - linked project refをSHA-256化し、固定hashとexact比較。
  - ref実値はsource/resultへ記録しない。
- SQLとvalidatorのSHA不一致時はSQL実行前SAFE STOP。
- CLI version不一致、project identity不一致もSQL実行前SAFE STOP。
- raw CLI response、URL、row、Secretは出力しない。
- 出力はsafe code、更新件数、booleanだけ。
- executorからrollbackを呼ぶ経路は存在しない。

## validator

- source: `tools/validate_portal_apps_display_fix_sealed_20260717.mjs`
- normalized LF SHA-256:
  `2C401DC386092B5C33D6F8FC80059266A7E8314EAF4620F2806920B5466AE28D`
- static checks: 17
- result: PASS

検査対象:

- transaction/timeouts
- target app_id exactness
- current-value preconditions
- maximum 2 rows
- `idea-link` UPDATE不存在
- INSERT / DELETE / DDL等の不存在
- rollback非自動実行
- CLI / production target / SQL identity固定
- sanitized executor output

## rollback

- source: `supabase/portal-apps-display-fix-sealed-rollback-20260717.sql`
- normalized LF SHA-256:
  `4756177E2BB249C8CD6585EFD9590BAD27194D0E4B07EB1B7724A4C3395178C1`
- status: PREPARED ONLY
- automatic execution: false
- execution: fresh separate approval required

## local fixture

分離PostgreSQL用bundle:

- manifest:
  `work/local-nonproduction-sql-lane-20260715/bundles/hub-portal-apps-display-sealed-v1.json`
- SHA-256: `9E5EEFBD2772B37257FE8617E02C6430D0A321308079441F4507D4BA64D5786F`
- synthetic rows: 4
  - EDU
  - THANKS
  - idea-link
  - unrelated control row
- expected forward: `4|1|1|1|1`
- expected rollback: `4|1|1|1|1`
- production connection: 0

bundle validatorはPASS。ローカルPodman connectionがunavailableのためSQL engine
rehearsalは起動前SAFE STOPした。

```yaml
local_bundle_validation: PASS
local_sql_engine: UNAVAILABLE
local_sql_execution: not_started
production_access_count: 0
source_static_contract: PASS
```

## production execution stop conditions

- fresh explicit approvalがない。
- SQL / validator / executor SHAが不一致。
- Supabase CLIが2.109.1以外。
- linked production identityが固定hashと不一致。
- production current valuesがauthoritative snapshotと不一致。
- app_idの欠落・重複。
- `idea-link` current value drift。
- UPDATE対象が2行以外。
- raw resultの表示が必要。
- rollbackが必要になった場合。rollbackは自動実行しない。

## CoreOS review request

```yaml
sealed_execution_contract_review: approve | hold
production_portal_apps_dml: separate_gate_required
target_table: public.portal_apps
target_app_ids:
  - EDU
  - THANKS
maximum_updated_rows: 2
idea_link_diff: 0
other_rows_diff: 0
rollback_execution: separate_gate_required
```

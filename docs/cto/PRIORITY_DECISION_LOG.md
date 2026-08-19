# Portfolio Priority Decision Log

## 2026-08-18 — Owner Portfolio Execution Order V2

DECISION_ID: OWNER-PORTFOLIO-ORDER-2026-08-18-V2

LOCK_ID: CTO-PORTFOLIO-EXECUTION-ORDER-2026-08-18-V2

DECIDED_BY: IDEA NOVグループ代表取締役社長

STATUS: ACTIVE

### 決定内容

1. DBF完成。
2. DBF管理UI完成。
3. 店舗営業管理構築・実働。
4. 法人経営管理構築・実働。

### 失効した旧方針

- 法人経営管理先行。
- 店舗営業管理先行。
- DBFとUIの並行優先。

上記はすべて失効しており、現在値として使用してはならない。

### 変更理由

- 方針の揺れによる構築遅延を防止する。
- Backend、運用UI、Consumer Appの順序を明確化する。
- AI／CTOによる自動的な再優先順位付けを禁止する。
- 各工程の完成条件を固定する。

## Repository内の旧方針調査

`origin/main`（`729354f2493eb3375a65a3b291451bcb0f149259`）のMarkdownおよびtext文書を、次の矛盾する現役指示について検索した。

- 法人経営管理を店舗営業管理より先に進める。
- Store Operationsを現在触らない。
- 法人会計Actual Promotion後すぐ法人経営管理へ進む。
- DBF専任としてPortfolio全体を止める。
- V2の4段階と矛盾するCURRENT PRIORITY。

結果: 該当する矛盾したACTIVE Portfolio指示は0件。

### SUPERSEDED対象文書

なし。

将来、矛盾するACTIVE指示が特定された場合は削除せず、必要最小限の対象文書の先頭に次を追加して、この一覧へpathを登録する。

```text
STATUS: SUPERSEDED

この文書のPortfolio優先順位は失効しています。

最新の唯一の正本：

docs/cto/PORTFOLIO_PRIORITY_LOCK.md

旧Priorityを現在値として使用してはいけません。

技術情報や完了履歴は参照可能ですが、
実行順序は最新Priority Lockに従ってください。
```

### 検索候補だが対象外とした文書

- `docs/architecture/14_pr001_core_master_migration_design_package.md`: Store OperationsのCore Master接続Gateを定義する技術文書。Portfolio順序を定義しない。
- `docs/platform/staging-first-development-policy.md`: Production環境を保護する開発ポリシー。Store Operationsを現在触らないというPortfolio指示ではない。
- `docs/architecture/19_pr002_accounting_foundation_design_package.md`: Accounting projectionの技術境界。法人経営管理先行を指示しない。
- `docs/dbf-cloud-run-ready-endpoint-corrective-20260814.md`: DBF Phase A correctiveの局所contract。Portfolio全体のACTIVE Priorityではない。

これらは技術情報または履歴として正本Lockと両立するため変更しない。

## 2026-08-19 — Owner Phase Transition to DBF Management UI Completion

DECISION_ID: OWNER-PHASE-TRANSITION-2026-08-19-PHASE-2

LOCK_ID: CTO-PORTFOLIO-EXECUTION-ORDER-2026-08-18-V2

DECIDED_BY: IDEA NOVグループ代表取締役社長

STATUS: ACTIVE

### Transition

- Previous Phase: `PHASE_1_DBF_BACKEND_COMPLETION` — COMPLETE.
- Current Phase: `PHASE_2_DBF_MANAGEMENT_UI_COMPLETION` — ACTIVE.
- Transition Date: 2026-08-19.
- Phase 1 Final main HEAD: `d48f863f2bcaef87f2e1145b775bad329ae90a3b`.
- Staging Backend Smoke: PASS.
- Store Monthly Authenticated Smoke: PASS.
- Corporate Accounting Authenticated Smoke: PASS.
- Business Data Write: 0.
- Production Change: 0.
- Phase 1 Blocking: 0.

### Owner Approval

OwnerはPhase 1 Exit Criteriaの完了を確認し、Phase 2 DBF Management UI Completionの有効化を明示承認した。

固定実行順序は変更しない。

1. `PHASE_1_DBF_BACKEND_COMPLETION` — COMPLETE
2. `PHASE_2_DBF_MANAGEMENT_UI_COMPLETION` — CURRENT
3. `PHASE_3_STORE_OPERATIONS_MANAGEMENT_V1`
4. `PHASE_4_CORPORATE_MANAGEMENT`

## 2026-08-19 — Owner Phase Transition to Store Operations Management V1

DECISION_ID: OWNER-PHASE-TRANSITION-2026-08-19-PHASE-3

LOCK_ID: CTO-PORTFOLIO-EXECUTION-ORDER-2026-08-18-V2

DECIDED_BY: IDEA NOVグループ代表取締役社長

STATUS: ACTIVE

### Transition

- Previous Phase: `PHASE_2_DBF_MANAGEMENT_UI_COMPLETION` — COMPLETE.
- Current Phase: `PHASE_3_STORE_OPERATIONS_MANAGEMENT_V1` — ACTIVE.
- Transition Date: 2026-08-19.
- Phase 2 Final main HEAD: `21c3fbaa83fb744e2fb03635036bc109ead39989`.
- DBF Management UI Progress: 100%.
- Single Ingestion Entry: ADOPTED.
- Hosted Staging: PASS.
- Owner UAT: PASS.
- Phase 2 Exit Criteria: COMPLETE.
- Business Data Write: 0.
- Production Change: 0.
- Phase 3 Implementation in Transition PR: 0.

### Owner Approval

OwnerはPhase 2 Exit Criteriaの完了を確認し、Phase 3 Store Operations Management V1の有効化を明示承認した。

固定Portfolio順序そのものは変更しない。

1. `PHASE_1_DBF_BACKEND_COMPLETION` — COMPLETE
2. `PHASE_2_DBF_MANAGEMENT_UI_COMPLETION` — COMPLETE
3. `PHASE_3_STORE_OPERATIONS_MANAGEMENT_V1` — CURRENT
4. `PHASE_4_CORPORATE_MANAGEMENT`

# Outcome 1 — Official Recruiting Facts

## 現在地

Status: IMPLEMENTED LOCALLY / NOT DEPLOYED

Outcome 1は、Selection Historyを正式な選考事実、Candidate current statusを表示用Projection、Source Factを未連結Evidenceとして分離する。この変更はStaging向けのMigration authoringとAPI / UI変更のみで、DB適用、Backfill、Deploy、Production変更は行わない。

## 正式責務

| Domain | 正式責務 |
|---|---|
| Event / Contact | 接触、LINE登録、サロン見学、連絡履歴 |
| Selection History | 応募、面接、内定、内定承諾、辞退、不採用のappend-only事実 |
| Candidate | 候補者同一性と、最新の正式Selection Factから生成する参照用Projection |
| Source Fact | Candidateに明示連結されるまでの不変Evidence。KPIへ直接加算しない |

Selection codeはordinalではなく、自動遷移は推測しない。7つの正式factは順不同・後日補記でappendできる。Projectionは effective_date DESC, created_at DESC, selection_history_id DESC で決定し、codeに意味上の順位を与えない。

OFFERED_ELSEWHEREはCandidate表示状態としては互換維持するが、NOVの正式Selection Fact / KPIには含めない。

## Migration / API

- Migration: 20260808083752_nov_talent_official_recruiting_facts.sql
- Selection append RPC: nov_talent_append_selection_transition_v1
- Source Evidence link RPC: nov_talent_link_source_fact_v2
- 新規SelectionはCandidate行をFOR UPDATEし、Candidate versionを確認した後、Selection append、Projection更新、Selection audit、Candidate auditを1 transactionで行う。
- HUB Sessionで解決したactor UUID / roleだけをRPCへ渡す。Browserからactorを受け取らない。
- service roleには対象TableのSELECTだけを付与し、DMLはSECURITY DEFINER RPCに限定する。
- Source linkはCandidate / Source両version、固定参照、Source fingerprint hash、resolution method、理由を必須とする。氏名類似だけでは連結しない。

## Coverage

Coverageは、正式Selection行数、unique Candidate数、未連結Evidence数を別粒度で表示する。Candidate current statusをSelection KPIの代替Sourceにしない。

Workspace Contract v1.0.0のexact shapeは変更しない。`unlinkedSelectionHistory` は正式な `fact_date` を持つEvidenceの詳細表示専用とし、日付不明のEvidenceを混在させない。`created_at`、Import日時、Candidate作成日、当日、sentinel等による日付補完は禁止する。

Source全体の状態は独立したread-only Selection Coverage Contract v1.0.0で返す。最低限、未連結Evidence総数、日付あり、日付不明、正式Selection行数、正式Selectionのunique Candidate数を保持する。Candidateが安全に特定されていない未連結Evidenceのunique Candidate数は `null` とする。Source取得失敗時は全Coverage countを `null`、stateを `PREPARING` とし、WorkspaceとCandidate一覧はHTTP 200を維持する。Selection KPIの公開Gateは引き続き閉じる。

## Controlled rollout

1. 新Edgeを NOV_TALENT_OUTCOME1_WRITES_ENABLED=false で先に公開し、flag=falseが反映済みであることを確認する。Workspaceと従来Event / Next Actionのread / writeは維持する。
2. flag=false確認後に、同一release identityのPagesを公開する。Selection append、Source link、新しいCOMMUNICATION_RECORDEDは、activation flagがfalseの間 503 OUTCOME1_MIGRATION_REQUIRED でDBを呼ばず安全停止する。画面全体は停止しない。
3. 従来RPCへのfallbackは行わない。従来Selection書込みはProjectionと同一transactionでなく、従来Source linkはCandidate version / stable evidenceを証明できないためである。契約・権限4xx、その他5xxにもfallbackしない。
4. Staging Migrationを1回適用する。Fresh DB Gate、schema catalog、RLS / Grant、RPC contractがPASSするまで適用を承認しない。
5. MigrationとRemote contract gateのPASS後だけ NOV_TALENT_OUTCOME1_WRITES_ENABLED=true へ切り替え、認証付きでSelection append / Projection / Source link / Communication / Coverageをsmoke testする。

Migration前の短い間は新規Selection / Source link / COMMUNICATION_RECORDEDだけがfail closedになる。安全でない従来writeで無停止を偽装しない。

## Dependency / blocker / completion

- Dependency: Outcome 0公開版、Workspace Contract v1.0.0、Data Dictionary v1.6.0、HUB actor identity。
- Verification: Fresh isolated PostgreSQL 17.6でMigration apply、制約・権限・atomic append / projection、guarded rollback、clean rollback、reapply、catalog一致を確認済み。試験clusterとfixtureは削除済み。
- Blocker: Staging Apply、flag有効化、Deploy、認証付きPC / Mobile E2Eは未承認・未実施。過去Source FactのCandidate連結は別のHuman Review / Backfill Gate待ち。
- Completion: Fresh DB、static / API / contract / regression、PC / Mobile、認証付きStaging E2EがPASSし、Coverageとpartial stateが正式証拠と一致したときのみOutcome 1 Completeと判定する。

## Rollback

Migrationのrollbackは、最初に NOV_TALENT_OUTCOME1_WRITES_ENABLED=false の反映を確認し、次にbusiness-fact guardを評価してから、新RPC / trigger / index / projection columns / Source Evidence columnsを明示対象とするreview-only rollback scriptを適用する。Projection参照を持つSelection、新しいSource link、COMMUNICATION_RECORDEDのいずれかが存在する場合、自動で履歴を削除せず停止する。Candidate、Event、Selection、Source Factの業務行を物理削除しない。

# Fair Attribution Contract v1.0.0-draft

## 1. Contract purpose

CandidateがどのFairを起点とするかを、選考事実とは分離して監査可能に記録します。Candidateの同一性が確認できても、それだけではFair起点を証明しません。

## 2. Candidate–Fair Attribution

| Field | Type | Required | Rule |
|---|---|---:|---|
| `attribution_id` | UUID | yes | server-generated stable ID |
| `candidate_id` | UUID | yes | Candidate正式ID |
| `fair_id` | UUID | yes | Fair正式ID |
| `attribution_type` | enum | yes | v1は`ORIGIN`のみ |
| `attribution_status` | enum | yes | `PENDING` / `CONFIRMED` / `REJECTED` |
| `source_type` | enum | yes | `FORMAL_SOURCE` / `HUMAN_REVIEW` / `OPERATIONAL_ENTRY` |
| `source_reference` | opaque string | yes | 個人情報を含まない安定参照 |
| `source_date` | date | no | 証拠の発生日。未確認はNULL |
| `evidence_reference` | opaque string | yes | private evidenceへの参照。生データを保存しない |
| `confirmed_by` | actor ID | conditional | `CONFIRMED` / `REJECTED`時に必須 |
| `confirmed_at` | timestamp | conditional | `CONFIRMED` / `REJECTED`時に必須 |
| `created_at` | timestamp | yes | server timestamp |

### Invariants

- KPIに利用できるのは`attribution_type=ORIGIN`かつ`attribution_status=CONFIRMED`のみです。
- 1 Candidateにつき、有効な`CONFIRMED ORIGIN`は最大1件です。
- 同一Fair内で同一Candidateを複数回数えません。
- 氏名だけ、学校だけ、開催日の近さだけでは自動作成・自動確認しません。
- Candidate Identity Contractの強いキー一致はCandidate同一性の証拠であり、Fair起点の証拠ではありません。
- 複数Fair候補、矛盾、証拠不足は`PENDING`としてHuman Reviewへ送ります。
- `REJECTED`は削除せず監査証跡として保持します。

### Attribution Type policy

v1の正式Typeは`ORIGIN`だけです。`contacted`、`line_registered`、`salon_tour`、`interview_origin`をAttribution Typeへ増やしません。接触・LINE登録・見学はEvent / Contact、面接はSelection Historyの責務です。

## 3. Selection History Contract

| Field | Type | Required | Rule |
|---|---|---:|---|
| `selection_history_id` | UUID | yes | server-generated stable ID |
| `candidate_id` | UUID | yes | Candidate正式ID |
| `selection_stage` | enum | yes | Data Dictionaryの正式コードのみ |
| `occurred_at` | timestamp/date | yes | 事実の発生日 |
| `status` | enum | yes | active / corrected / invalidated等の正式状態 |
| `source_type` | enum | yes | 正式Source区分 |
| `source_reference` | opaque string | yes | 個人情報を含まない安定参照 |
| `version` | positive integer | yes | 楽観ロック・監査用 |
| `created_at` | timestamp | yes | server timestamp |
| `updated_at` | timestamp | yes | server timestamp |

面接・内定をFair Masterへ直接入力しません。Selection HistoryをCandidate–Fair Attributionと`candidate_id`で結合して導出します。

## 4. KPI Derived Contract

すべて有効Fairを対象とし、Candidate単位で重複排除します。

### interview_count

`COUNT(DISTINCT candidate_id)` where:

- Fairへの`CONFIRMED ORIGIN`が存在する
- Selection Historyに正式な`INTERVIEW_COMPLETED`事実が存在する
- AttributionとSelection Historyが有効

### offer_count

`COUNT(DISTINCT candidate_id)` where:

- Fairへの`CONFIRMED ORIGIN`が存在する
- Selection Historyに正式な`OFFERED`事実が存在する
- AttributionとSelection Historyが有効

### hire_count

Business Owner承認により、Fair成果における`hire_count`は`offer_count`と同義です。ただし正式SourceはFair Masterのlegacy列ではなく、`CONFIRMED ORIGIN`と正式な`OFFERED`事実から導出したunique Candidate数です。

- UIでは原則「内定数」と表示します。
- 互換名称の「採用数」「採用率」「採用単価」は、それぞれ内定数・内定率・内定単価のaliasです。
- 実入社はFair成果KPIへ含めません。

### Rates and cost

- 面接率、内定率の分母は業務定義承認後に固定します。
- 内定単価は正式なFair費用を正式`offer_count`で除して計算します。
- 互換名称の採用率・採用単価は内定率・内定単価と同義です。
- 分子・分母が未確定またはNULLなら「集計準備中」です。
- NULLを0へ変換しません。

## 5. Employee Core boundary

NOV Talentの責務は入社前までです。Fair成果KPIは内定を最終到達点とし、実入社を含めません。将来、実入社を追跡する場合だけCandidateとEmployee Coreの正式な引継ぎ参照を使ってread-onlyで確認します。Employee Coreの社員情報・権限・履歴はNOV Talentへ取り込まず、NOV TalentからEmployee Coreへ書込みません。

## 6. Security and privacy

- APIの認可はserver-sideで実施します。
- evidence本体、氏名、電話、email、LINE値をGitHub、Markdown、ログへ記録しません。
- ログはattribution ID、reason code、actor role、timestampのみとします。
- 自動統合、自動削除、推測補完を禁止します。

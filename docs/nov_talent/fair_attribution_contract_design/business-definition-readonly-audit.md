# Business Definition Approval / Read-only Cross-source Audit

Audit date: 2026-08-07

対象は27卒の正式Spreadsheet 1件と`idea-nov-staging`です。個人名、連絡先、Candidate IDは記録していません。DB・Spreadsheetへの書込みは0件です。

## Approved business definition

- Fair成果の採用数 = 内定数
- 採用率 = 内定率
- 採用単価 = 内定単価
- 実入社はFair成果KPIへ含めない

## Source inventory

| Source | 実データ | Current role |
|---|---:|---|
| 接触学生一覧（27卒） | 528行 | CandidateとFair起点Evidence候補 |
| エントリー一覧 | 42行 | 面接日・選考結果の補助Evidence |
| 【27卒】内定者情報 | 35行 | 過去内定の第一Source Evidence候補 |
| Candidate（27卒、active） | 528件 | Candidate正本 |
| Selection History（active） | 0件 | 将来の面接・内定正式Source |
| Fair Master（active） | 46件 | Fair正本。legacy KPI列は非正本 |

## Candidate–Fair Attribution candidates

接触学生一覧の「きっかけ」と有効Fair名を、表記正規化後の完全一致または相互包含だけで候補生成しました。これは確定処理ではありません。

- きっかけ入力行: 528件
- Fair対応候補を生成できた行: 161件
- Fair候補が1件に絞れた行: 121件
- 複数Fair候補: 40件
- 現時点のCONFIRMED: 0件
- Human Review対象: 161件
- Fair Masterと対応候補を生成できなかったきっかけ: 367件

121件はHuman Reviewで確認可能な一意候補ですが、自動CONFIRMEDにはしません。40件は開催月・日付等の追加Evidenceが必要です。367件には紹介、媒体、学校等のFair以外のきっかけが含まれ得るため、Fairへ強制対応しません。

## Interview candidates

- 接触学生一覧の面接日①・②: 入力0件
- エントリー一覧の面接日: 42行
- Candidate候補へ対応できたunique Candidate: 31件
- うち氏名＋学校の一意候補: 26行
- 氏名のみの一意候補: 5行
- 曖昧または未対応: 11行
- Selection Historyの正式面接事実: 0件
- Source Fact `INTERVIEW_COMPLETED`: 42件、Candidate連結0件

したがって面接Candidate候補は31件ですが、正式面接KPIへ利用できるCONFIRMED件数は0件です。

## Offer candidates

- 【27卒】内定者情報: 35行
- エントリー一覧の採用・条件付き採用: 35行
- 内定者情報からCandidate候補へ対応: 26件
- エントリー一覧からCandidate候補へ対応: 25件
- 両Sourceで一致したCandidate候補: 25件
- 内定者情報だけで対応したCandidate候補: 1件
- Candidate候補union: 26件
- 内定者情報の未対応: 9行
- Selection Historyの正式内定事実: 0件
- Candidate current statusの`OFFERED`: 0件
- Source Fact `OFFERED`: 35件、Candidate連結0件

過去データの正式Evidence候補は、明示的な内定者一覧である`【27卒】内定者情報`を第一候補、エントリー一覧の結果を補助Evidenceとします。運用上の正本は、Human Review後にCandidate単位で記録されるSelection History `OFFERED`です。

## Fair-specific offer candidates

内定Candidate候補26件のうち、Fair候補が1件に絞れたものは7件です。

| Fair candidate | 内定Candidate候補 |
|---|---:|
| ヘアワークス（立川） | 6件 |
| ヘアワークス（新宿） | 1件 |

残る19件は一意のFair候補がなく、Fair別内定数へ計上できません。上記7件もHuman Review前のため正式KPIには計上しません。

## Source inconsistencies

1. Selection Historyが0件で、面接42件・内定35件のSource FactもCandidate未連結です。
2. エントリー42行の内訳は、採用33、条件付き採用2、辞退2、不採用5です。
3. 内定者情報35行とエントリーの内定Evidence候補35行は件数一致しますが、Candidate候補として一致できたのは25件です。
4. Candidateへ対応できた内定候補26件のうち、Fair候補が一意なのは7件です。
5. Candidate current statusには`OFFERED`がなく、Selection Historyへの正式化が必要です。

## No-write confirmation

- Spreadsheet write: 0
- Database write: 0
- Migration / Backfill: 0
- automatic CONFIRMED: 0

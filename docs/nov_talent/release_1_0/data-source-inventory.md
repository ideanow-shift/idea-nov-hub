# NOV Talent v1.0 Data Source Inventory

## Current runtime

公開求人管理は `idea-nov-staging` のStaging Runtimeを使用します。Workspace Contract `1.0.0`を初期表示の唯一のレスポンス正本とし、ブラウザからDBへ直接アクセスしません。

Mock Runtimeは固定回帰と安全な開発用Feature Flagとして保持しますが、公開Stagingの業務データ正本ではありません。

## Current data baseline

| Domain | Current source | Current state | Formal responsibility |
|---|---|---|---|
| Candidate | Staging Candidate Master | 有効636件（27卒528件、28卒108件） | 学生同一性と現在状態のProjection |
| Event / Contact | Staging Recruitment Event / Contact | 接続済み | 接触、LINE登録、サロン見学の発生事実 |
| Selection | Staging Selection History | Table / API / UI接続済み、履歴0件 | 応募、面接、内定、内定承諾、辞退、離脱、不採用の発生事実 |
| Next Action | Staging Next Action | Table / API / UI接続済み | 今日やること、担当、期限、完了状態 |
| School | Staging School Master | 総数100件、有効99件 | 学校同一性、正式名称、学校数、学校分析の対象集合 |
| Fair | Staging Fair Master | 総数82件、有効46件 | Fair基本情報と接触・LINE登録・見学の正式実績 |
| Fair origin | Candidate–Fair Attribution | Workflow接続済み、Attribution 0件 | `CONFIRMED ORIGIN`だけをFair起点として利用 |
| Source Fact | Staging Source Fact | Evidence保持、Candidate連結未完了 | 安全な連結前のImport Evidence。正式KPIへ直接利用しない |
| Spreadsheet | 既存正式Spreadsheet | 参照用アーカイブ | 過去Source Evidence。日常の新規入力・通常更新は行わない |

## Source-of-Truth rules

1. Candidateの `current_status` は現在表示用Projectionであり、過去の選考履歴ではありません。
2. Event / Contactは接触、LINE登録、サロン見学を記録します。面接・内定をEventだけから正式確定しません。
3. Selection Historyは応募、面接、内定、内定承諾、辞退、離脱、不採用の正式な発生事実です。
4. Source FactはCandidateへ安全に連結され、正式契約で有効化されるまでEvidenceです。Selection HistoryやEventと加算・最大値比較しません。
5. Fairの面接・内定等は `CONFIRMED ORIGIN` とSelection HistoryからCandidate単位で導出します。
6. Fair Masterのlegacy `interview_count`、`offer_count`、`hire_count`は正式Sourceではありません。
7. 学校数と正式な学校分析の対象集合はACTIVE School Masterです。Candidateの学校名をMaster取得失敗や正式0の代替にしません。
8. Eventの接触行数とSelection / LINEのunique Candidate数は粒度が異なるため、そのまま率へ変換しません。全体LINE登録率とSchool応募率・内定率は同一粒度の正式契約まで集計準備中です。
9. NULLは未登録、0は正式に観測された0として区別します。

## Runtime and security boundary

- Public frontend: GitHub Pages
- Server-side API: Staging専用NOV Talent Edge Function
- Authentication: NOV HUB Session
- Browser direct DB access: 禁止
- Production `idea-nov-core`: 接続・書込み対象外
- Spreadsheetへのreverse write / bidirectional sync: 禁止
- Employee Core / LINEへの書込み: v1.0対象外

## Historical Mock evidence

匿名147件のMock Seedと旧 `mock-repository.mjs` は、初期Releaseの固定回帰証拠として残します。これらの件数・状態・status codeを現行Stagingの業務件数や正式Sourceとして報告しません。

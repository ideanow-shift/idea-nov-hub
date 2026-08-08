# Outcome 1 Workspace Coverage Hotfix

## 判定境界

- Workspace Contractは `1.0.0` を維持する。
- Data Dictionaryは `1.6.0` を維持する。
- `UnlinkedSelection[]` は正式な `fact_date` を持つEvidence詳細だけを返す。
- 日付不明Evidenceは削除も0扱いもせず、独立したSelection Coverage Contract `1.0.0`で集計する。
- NULL日付を別の日付やsentinelで補完しない。
- Source Evidenceを正式Selection数、面接数、内定数へ加算しない。

## Read-only Coverage

`GET /api/talent/v1/selection-coverage` は、正式Selection行数とunique Candidate数、未連結Evidenceの総数・日付あり・日付不明を返す。未連結EvidenceからCandidateを安全に特定できない場合、unique Candidate数は `null` とする。

Selection HistoryまたはSource Factの取得に失敗した場合、HTTP 200で `sourceCoverageState=PREPARING` とnullable countを返す。Workspace本体はpartial状態のHTTP 200を維持し、UIは0件ではなく「集計準備中」と表示する。

## 今回の非対象

Migration、DB schema変更、Selection/Source Fact書込み、write flag有効化、Fair Attribution Population、Production変更は行わない。

# NOV Talent v2 Release 1.0 data source inventory

本Inventoryはsource-only調査であり、Production/DB/Supabaseへ接続していない。

| 領域 | Release 1.0レビュー用Source | 将来の正式接続境界 | 状態 |
|---|---|---|---|
| 候補者 | `portal/talent/mock-seeds.mjs` の匿名27卒27件＋28卒120件、合計147件 | Candidate API/Repository契約へ差替え | Mock READY |
| Repository | `portal/talent/mock-repository.mjs` | 同じ `getSummary` / `getWorkspace` / `getTodayTasks` 境界をProduction adapterで実装 | Mock READ ONLY |
| イベント | Candidateの `eventHistory`、集計はstatus code | Candidate Event API | Mock |
| 接触 | Candidateの `contactHistory` と `CONTACT` | Candidate Contact API | Mock |
| 面接 | `statusCode=INTERVIEW` と `selectionHistory` | Candidate Selection API | Mock |
| 内定 | `statusCode=OFFER`、`offerDate`、`OFFERS_27/28` | Candidate Offer API | Mock |
| 承諾 | `statusCode=PASSED` | Candidate Offer/Acceptance API | Mock |
| 入社予定 | `statusCode=EXPECTED_JOIN`、`expectedJoinDate` | Employee Core handoffは入社時の別契約。NOV Peopleデータは保持しない | Mock表示のみ |
| 次回対応 | `nextActionAt` / `nextActionLabel`、`getTodayTasks(limit:5)` | Candidate Task/Next Action API | Mock |
| 28卒CSV | `portal/talent/csv-import-preflight.mjs`、`CONTACTS_28/ENTRIES_28/OFFERS_28` | ローカルpreflight後の別承認staging契約 | Local validation only |

`portal/talent/runtime-config.candidate.js` は `runtimeMode=mock`、`networkEnabled=false`、`writeEnabled=false`。接続URL・credential・Supabase clientを持たない。Production data adapter、write API、Employee Core handoffはRelease 1.0公開後の別承認対象とする。

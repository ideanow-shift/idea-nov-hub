# Outcome 0 — Accuracy & Contract Alignment

## Purpose

Outcome 0の目的は「画面が動くこと」ではなく、総務人事部と代表へ誤った判断材料を表示しないことです。新しい分析機能は追加せず、既存field、正式Source、NULL / 0、日付粒度の契約を一致させます。

## Scope

| Finding | Canonical rule | Risk tier |
|---|---|---|
| Today's Dashboardの `date` / `dueDate` 不一致 | Workspace `todayTasks[].dueDate`を正本とし、業務日はAsia/Tokyoで統一する | Tier 1 |
| Fair月Filterの `YYYY-MM-DD` / `YYYY-MM` 不一致 | `event_date`を一度だけ `YYYY-MM`へ正規化する | Tier 1 |
| legacy Fair KPI | `interview_count`、`offer_count`、`hire_count`を正式分析・入力から除外する | Tier 1 / 2 |
| Fair nullable入力 | 空欄を0へ変換しない。NULLと正式0を維持する | Tier 1 / 2 |
| 接触数 | Candidate総数ではなく正式Event / Contact Factから算出する | Tier 2 |
| Source混在 | Candidate current status、Source Fact、Selection Historyを `max`、加算、truthy fallbackで混在させない | Tier 2 |
| School接触数 | 学校所属Candidate数ではなく正式Event Factから算出する | Tier 2 |
| `task.priority` | Workspace Contractに存在しないfieldを参照せず、v1.0では期限から決定的に導出する | Tier 1 |

## Formal source responsibilities

- Candidate: 人物同一性と現在状態のProjection
- Event / Contact: 接触、LINE登録、サロン見学の発生事実。接触件数はACTIVE Candidateに紐づくACTIVE `CONTACT_RECORDED` Event行数
- Selection History: 応募、面接、内定、内定承諾、辞退、離脱、不採用の発生事実
- School Master: 学校同一性、正式名称、学校数、学校分析の対象集合。Candidateの学校名をMaster未取得時の代替Sourceにしない
- Fair Master: Fair同一性、基本情報、Fair数、接触・LINE登録・見学の保存済み正式実績
- Source Fact: Candidate未連結のImport Evidence。安全な連結前は正式集計対象外
- Fair Attribution: `CONFIRMED ORIGIN`のみ正式なFair起点
- Fair lower funnel: `CONFIRMED ORIGIN` + Selection Historyのdistinct Candidate集計
- Legacy Fair fields: 互換保持のみ。正式な面接・内定・採用Sourceとして利用禁止
- Legacy cross-domain activity: 既存行の表示・理由付き無効化・復元のみ。Eventへの面接、Selectionへの見学の新規作成・内容更新は禁止
- Cross-grain rates: Event行数とunique Candidate数を同じ率の分子・分母に混在させない。全体LINE登録率とSchool応募率・内定率は、同一粒度の正式契約ができるまで集計準備中

## Contract impact

- Workspace Contract Version: `1.0.0`を維持
- Workspace response schema: 変更なし
- 手書きValidator追加: なし
- DB schema / Migration: 原則不要
- Candidate / Fair data mutation: なし
- Fair Attribution Population: 本Outcomeの実行対象外。DB司令塔のData Gateを正本とする
- Production: 変更・書込み禁止

## Gates

UI / read-only変更はCI、Unit、Visual、PC / Mobile、認証済みE2Eで確認します。後方互換APIまたは集計変更は同一Workspace SchemaのContract Test、Staging E2E、partial failureを追加します。Schema変更がない変更へMigration Gateを適用しません。

## Completion

- 8件の既知不整合について誤表示・誤集計が残っていない
- NULLを正式0として表示・保存しない
- 未接続Factを0や他Sourceの値で代替しない
- Workspace Contract `1.0.0`を維持
- Candidate / Fair / Productionへの書込み0
- 固定回帰、認証E2E、Console Error / Warning 0

# ADR: Legacy Fair KPI Columns

Status: `ACCEPTED_FOR_DESIGN / IMPLEMENTATION_PENDING`

## Context

Fair Masterには`interview_count`、`offer_count`、`hire_count`が存在します。しかし監査では、正式Selection HistoryやCandidate–Fair Attributionとの接続を確認できず、一部の0値は旧schemaのdefaultによって作成された可能性があります。

## Decision

- 既存3列を面接・内定・採用の正式Sourceとして使用しません。
- 既存値を削除、書換え、NULL化しません。
- 正式KPIはCandidate–Fair Attributionと正式事実から再計算します。
- 当面の位置付けは`deprecated compatibility projection`です。
- 将来の選択肢は、derived cache、read-only projection、列廃止候補です。実装判断はMigration影響監査後に別ADRで行います。
- 正式Calculatorはlegacy列を入力に使用しません。

## Consequences

- 既存の0は正式な「実績0」として表示できません。
- 正式契約が完成するまで画面は「集計準備中」を維持します。
- 将来cacheとして使う場合でも、元事実、計算version、計算日時、再構築可能性が必要です。

## Rejected alternatives

- すべての0を正式0とみなす。
- すべての0をNULLへ一括変換する。
- Fair Masterへ面接・内定・採用を直接入力する。
- 名前や日付からFair起点を推測する。

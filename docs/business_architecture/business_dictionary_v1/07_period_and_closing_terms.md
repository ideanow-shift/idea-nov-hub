# Period / Closing terms

辞書version: 1.0-draft / 用語数: 17

## 営業日 (`business_day`)

| field | value |
|---|---|
| term_id | period.business_day |
| technical_key | business_day |
| japanese_name | 営業日 |
| display_name | 営業日 |
| category | period |
| definition | 店舗timezoneと承認済み境界時刻で決まる業務日。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | period / store |
| unit | date |
| timezone | Asia/Tokyo |
| source_of_truth | 店舗営業Business Contract候補 |
| update_frequency | 随時 |
| owner | 営業部 / 経理 |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 業務scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 深夜跨ぎ・店舗別境界・休業日 |
| effective_from | — |
| version | 1.0-draft |

## 暦日 (`calendar_day`)

| field | value |
|---|---|
| term_id | period.calendar_day |
| technical_key | calendar_day |
| japanese_name | 暦日 |
| display_name | 暦日 |
| category | period |
| definition | Asia/Tokyoの00:00から24:00までの日付。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | period / store |
| unit | date |
| timezone | Asia/Tokyo |
| source_of_truth | 店舗営業Business Contract候補 |
| update_frequency | 随時 |
| owner | 営業部 / 経理 |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 業務scope |
| status | Proposed |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | — |
| effective_from | — |
| version | 1.0-draft |

## 月次 (`monthly_period`)

| field | value |
|---|---|
| term_id | period.monthly_period |
| technical_key | monthly_period |
| japanese_name | 月次 |
| display_name | 月次 |
| category | period |
| definition | 承認済み営業日規則でまとめたYYYY-MM期間。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | period / store |
| unit | month |
| timezone | Asia/Tokyo |
| source_of_truth | 店舗営業Business Contract候補 |
| update_frequency | 随時 |
| owner | 営業部 / 経理 |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 業務scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 締め境界と遡及修正 |
| effective_from | — |
| version | 1.0-draft |

## 当月 (`current_month`)

| field | value |
|---|---|
| term_id | period.current_month |
| technical_key | current_month |
| japanese_name | 当月 |
| display_name | 当月 |
| category | period |
| definition | 指定as-ofが属する月次期間。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | period / store |
| unit | month |
| timezone | Asia/Tokyo |
| source_of_truth | 店舗営業Business Contract候補 |
| update_frequency | 随時 |
| owner | 営業部 / 経理 |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 業務scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | as-ofとtimezone |
| effective_from | — |
| version | 1.0-draft |

## 前月 (`previous_month`)

| field | value |
|---|---|
| term_id | period.previous_month |
| technical_key | previous_month |
| japanese_name | 前月 |
| display_name | 前月 |
| category | period |
| definition | 当月の直前の月次期間。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | period / store |
| unit | month |
| timezone | Asia/Tokyo |
| source_of_truth | 店舗営業Business Contract候補 |
| update_frequency | 随時 |
| owner | 営業部 / 経理 |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 業務scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 比較version |
| effective_from | — |
| version | 1.0-draft |

## 前年同月 (`prior_year_same_month`)

| field | value |
|---|---|
| term_id | period.prior_year_same_month |
| technical_key | prior_year_same_month |
| japanese_name | 前年同月 |
| display_name | 前年同月 |
| category | period |
| definition | 当月の12か月前に対応する比較可能な月次期間。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | period / store |
| unit | month |
| timezone | Asia/Tokyo |
| source_of_truth | 店舗営業Business Contract候補 |
| update_frequency | 随時 |
| owner | 営業部 / 経理 |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 業務scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 店舗改廃時の比較 |
| effective_from | — |
| version | 1.0-draft |

## 速報 (`flash`)

| field | value |
|---|---|
| term_id | period.flash |
| technical_key | flash |
| japanese_name | 速報 |
| display_name | 速報 |
| category | period |
| definition | 完全性・承認前であることを明示した早期集計。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | period / store |
| unit | period |
| timezone | Asia/Tokyo |
| source_of_truth | 店舗営業Business Contract候補 |
| update_frequency | 随時 |
| owner | 営業部 / 経理 |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 業務scope |
| status | Proposed |
| aliases | 速報値 |
| exclusions | 確定値扱い |
| edge_cases | — |
| decision_required | — |
| effective_from | — |
| version | 1.0-draft |

## 暫定 (`preliminary`)

| field | value |
|---|---|
| term_id | period.preliminary |
| technical_key | preliminary |
| japanese_name | 暫定 |
| display_name | 暫定 |
| category | period |
| definition | source収集は進んでいるが検証または承認が未完了の状態。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | period / store |
| unit | period |
| timezone | Asia/Tokyo |
| source_of_truth | 店舗営業Business Contract候補 |
| update_frequency | 随時 |
| owner | 営業部 / 経理 |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 業務scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 速報との差と利用可能画面 |
| effective_from | — |
| version | 1.0-draft |

## 検証済み (`verified`)

| field | value |
|---|---|
| term_id | period.verified |
| technical_key | verified |
| japanese_name | 検証済み |
| display_name | 検証済み |
| category | period |
| definition | 定義済みvalidationを通過したが、業務承認とは別の状態。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | period / store |
| unit | period |
| timezone | Asia/Tokyo |
| source_of_truth | 店舗営業Business Contract候補 |
| update_frequency | 随時 |
| owner | 営業部 / 経理 |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 業務scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | validation checklistと実行者 |
| effective_from | — |
| version | 1.0-draft |

## 承認済み (`approved`)

| field | value |
|---|---|
| term_id | period.approved |
| technical_key | approved |
| japanese_name | 承認済み |
| display_name | 承認済み |
| category | period |
| definition | 権限を持つ業務ownerが特定versionを承認した状態。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | period / store |
| unit | period |
| timezone | Asia/Tokyo |
| source_of_truth | 店舗営業Business Contract候補 |
| update_frequency | 随時 |
| owner | 営業部 / 経理 |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 業務scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 承認者・代理・取消 |
| effective_from | — |
| version | 1.0-draft |

## 締め済み (`closed`)

| field | value |
|---|---|
| term_id | period.closed |
| technical_key | closed |
| japanese_name | 締め済み |
| display_name | 締め済み |
| category | period |
| definition | 対象periodへの通常writeを停止した状態。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | period / store |
| unit | period |
| timezone | Asia/Tokyo |
| source_of_truth | 店舗営業Business Contract候補 |
| update_frequency | 随時 |
| owner | 営業部 / 経理 |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 業務scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | daily/monthly closeと例外権限 |
| effective_from | — |
| version | 1.0-draft |

## 再オープン (`reopened`)

| field | value |
|---|---|
| term_id | period.reopened |
| technical_key | reopened |
| japanese_name | 再オープン |
| display_name | 再オープン |
| category | period |
| definition | 承認を受けて締め済みperiodを訂正可能にした状態。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | period / store |
| unit | period |
| timezone | Asia/Tokyo |
| source_of_truth | 店舗営業Business Contract候補 |
| update_frequency | 随時 |
| owner | 営業部 / 経理 |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 業務scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 実行権限、理由、再締め |
| effective_from | — |
| version | 1.0-draft |

## 遡及修正 (`retroactive_correction`)

| field | value |
|---|---|
| term_id | period.retroactive_correction |
| technical_key | retroactive_correction |
| japanese_name | 遡及修正 |
| display_name | 遡及修正 |
| category | period |
| definition | 過去periodの確定値を上書きせず新versionで訂正すること。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | period / store |
| unit | period |
| timezone | Asia/Tokyo |
| source_of_truth | 店舗営業Business Contract候補 |
| update_frequency | 随時 |
| owner | 営業部 / 経理 |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 業務scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 会計連携と表示期間 |
| effective_from | — |
| version | 1.0-draft |

## スナップショット (`snapshot`)

| field | value |
|---|---|
| term_id | period.snapshot |
| technical_key | snapshot |
| japanese_name | スナップショット |
| display_name | スナップショット |
| category | period |
| definition | 指定as-of・定義version・source versionで固定した派生集計。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | period / store |
| unit | period |
| timezone | Asia/Tokyo |
| source_of_truth | 店舗営業Business Contract候補 |
| update_frequency | 随時 |
| owner | 営業部 / 経理 |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 業務scope |
| status | Needs Business Decision |
| aliases | snapshot |
| exclusions | — |
| edge_cases | — |
| decision_required | 生成時点と再生成規則 |
| effective_from | — |
| version | 1.0-draft |

## バージョン (`version`)

| field | value |
|---|---|
| term_id | period.version |
| technical_key | version |
| japanese_name | バージョン |
| display_name | バージョン |
| category | period |
| definition | 定義・source・集計・承認の変更を識別するimmutable番号。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | period / store |
| unit | identifier |
| timezone | Asia/Tokyo |
| source_of_truth | 店舗営業Business Contract候補 |
| update_frequency | 随時 |
| owner | 営業部 / 経理 |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 業務scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 採番と互換性 |
| effective_from | — |
| version | 1.0-draft |

## 適用日 (`effective_date`)

| field | value |
|---|---|
| term_id | period.effective_date |
| technical_key | effective_date |
| japanese_name | 適用日 |
| display_name | 適用日 |
| category | period |
| definition | 定義またはmaster relationが業務上有効になる日。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | period / store |
| unit | date |
| timezone | Asia/Tokyo |
| source_of_truth | 店舗営業Business Contract候補 |
| update_frequency | 随時 |
| owner | 営業部 / 経理 |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 業務scope |
| status | Needs Business Decision |
| aliases | effective date |
| exclusions | — |
| edge_cases | — |
| decision_required | 時刻精度と終了境界 |
| effective_from | — |
| version | 1.0-draft |

## 基準時点 (`as_of`)

| field | value |
|---|---|
| term_id | period.as_of |
| technical_key | as_of |
| japanese_name | 基準時点 |
| display_name | 基準時点 |
| category | period |
| definition | 状態・scope・versionを評価する明示的な日時。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | period / store |
| unit | timestamp |
| timezone | Asia/Tokyo |
| source_of_truth | 店舗営業Business Contract候補 |
| update_frequency | 随時 |
| owner | 営業部 / 経理 |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 業務scope |
| status | Proposed |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | — |
| effective_from | — |
| version | 1.0-draft |

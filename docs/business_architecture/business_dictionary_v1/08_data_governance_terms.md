# Data Governance terms

辞書version: 1.0-draft / 用語数: 20

## 原本 (`original_record`)

| field | value |
|---|---|
| term_id | data_governance.original_record |
| technical_key | original_record |
| japanese_name | 原本 |
| display_name | 原本 |
| category | data_governance |
| definition | 変更前の一次資料またはsource system記録。正本採用とは別概念。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | data_object |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Data Governance Contract |
| update_frequency | 随時 |
| owner | Data owner / System owner |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 操作別権限。auditは限定参照 |
| status | Proposed |
| aliases | 原資料 |
| exclusions | — |
| edge_cases | — |
| decision_required | — |
| effective_from | — |
| version | 1.0-draft |

## 正本 (`sales_source_of_truth`)

| field | value |
|---|---|
| term_id | data_governance.sales_source_of_truth |
| technical_key | sales_source_of_truth |
| japanese_name | 正本 |
| display_name | 正本 |
| category | data_governance |
| definition | 指定業務事実について競合時に優先する、owner承認済みの唯一のsource。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | data_object |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Data Governance Contract |
| update_frequency | 随時 |
| owner | Data owner / System owner |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 操作別権限。auditは限定参照 |
| status | Unknown |
| aliases | source of truth |
| exclusions | — |
| edge_cases | — |
| decision_required | 店舗売上の正式正本を選定 |
| effective_from | — |
| version | 1.0-draft |

## ソースシステム (`source_system`)

| field | value |
|---|---|
| term_id | data_governance.source_system |
| technical_key | source_system |
| japanese_name | ソースシステム |
| display_name | ソースシステム |
| category | data_governance |
| definition | データを生成・管理する外部または内部system。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | data_object |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Data Governance Contract |
| update_frequency | 随時 |
| owner | Data owner / System owner |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 操作別権限。auditは限定参照 |
| status | Unknown |
| aliases | source system |
| exclusions | — |
| edge_cases | — |
| decision_required | 店舗売上source systemを特定 |
| effective_from | — |
| version | 1.0-draft |

## ソースファイル (`source_file`)

| field | value |
|---|---|
| term_id | data_governance.source_file |
| technical_key | source_file |
| japanese_name | ソースファイル |
| display_name | ソースファイル |
| category | data_governance |
| definition | import batchの入力となるimmutable fileとそのmetadata。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | data_object |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Data Governance Contract |
| update_frequency | 随時 |
| owner | Data owner / System owner |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 操作別権限。auditは限定参照 |
| status | Unknown |
| aliases | source file |
| exclusions | — |
| edge_cases | — |
| decision_required | 公式export formatと保管範囲 |
| effective_from | — |
| version | 1.0-draft |

## 取込バッチ (`import_batch`)

| field | value |
|---|---|
| term_id | data_governance.import_batch |
| technical_key | import_batch |
| japanese_name | 取込バッチ |
| display_name | 取込バッチ |
| category | data_governance |
| definition | 同一source、受領時点、checksum、処理結果を束ねる取込単位。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | data_object |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Data Governance Contract |
| update_frequency | 随時 |
| owner | Data owner / System owner |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 操作別権限。auditは限定参照 |
| status | Proposed |
| aliases | import batch |
| exclusions | — |
| edge_cases | — |
| decision_required | — |
| effective_from | — |
| version | 1.0-draft |

## ソース行 (`source_row`)

| field | value |
|---|---|
| term_id | data_governance.source_row |
| technical_key | source_row |
| japanese_name | ソース行 |
| display_name | ソース行 |
| category | data_governance |
| definition | source file内の位置と原値digestで追跡可能な最小入力行。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | data_object |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Data Governance Contract |
| update_frequency | 随時 |
| owner | Data owner / System owner |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 操作別権限。auditは限定参照 |
| status | Proposed |
| aliases | source row |
| exclusions | — |
| edge_cases | — |
| decision_required | — |
| effective_from | — |
| version | 1.0-draft |

## 外部ID (`external_id`)

| field | value |
|---|---|
| term_id | data_governance.external_id |
| technical_key | external_id |
| japanese_name | 外部ID |
| display_name | 外部ID |
| category | data_governance |
| definition | source system内で対象を識別するID。Core IDとは分離する。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | data_object |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Data Governance Contract |
| update_frequency | 随時 |
| owner | Data owner / System owner |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 操作別権限。auditは限定参照 |
| status | Proposed |
| aliases | external ID |
| exclusions | — |
| edge_cases | — |
| decision_required | — |
| effective_from | — |
| version | 1.0-draft |

## Core ID (`core_id`)

| field | value |
|---|---|
| term_id | data_governance.core_id |
| technical_key | core_id |
| japanese_name | Core ID |
| display_name | Core ID |
| category | data_governance |
| definition | IDEA NOV OSのcanonical master recordを識別するimmutable ID。名称をIDとして使わない。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | data_object |
| unit | UUID |
| timezone | Asia/Tokyo |
| source_of_truth | Core Master |
| update_frequency | 随時 |
| owner | Data owner / System owner |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 操作別権限。auditは限定参照 |
| status | Confirmed |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | — |
| effective_from | — |
| version | 1.0-draft |

## マッピング (`mapping`)

| field | value |
|---|---|
| term_id | data_governance.mapping |
| technical_key | mapping |
| japanese_name | マッピング |
| display_name | マッピング |
| category | data_governance |
| definition | external IDまたはsource valueをCore ID・canonical categoryへ対応付けるversion付き関係。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | data_object |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Data Governance Contract |
| update_frequency | 随時 |
| owner | Data owner / System owner |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 操作別権限。auditは限定参照 |
| status | Proposed |
| aliases | mapping |
| exclusions | — |
| edge_cases | — |
| decision_required | — |
| effective_from | — |
| version | 1.0-draft |

## マッピング保留 (`mapping_pending`)

| field | value |
|---|---|
| term_id | data_governance.mapping_pending |
| technical_key | mapping_pending |
| japanese_name | マッピング保留 |
| display_name | マッピング保留 |
| category | data_governance |
| definition | 一意なmappingが確定しておらずcanonical集計へ反映できない状態。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | data_object |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Data Governance Contract |
| update_frequency | 随時 |
| owner | Data owner / System owner |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 操作別権限。auditは限定参照 |
| status | Proposed |
| aliases | mapping pending |
| exclusions | — |
| edge_cases | — |
| decision_required | — |
| effective_from | — |
| version | 1.0-draft |

## 曖昧 (`ambiguous`)

| field | value |
|---|---|
| term_id | data_governance.ambiguous |
| technical_key | ambiguous |
| japanese_name | 曖昧 |
| display_name | 曖昧 |
| category | data_governance |
| definition | 複数候補があり自動で一意解決できない状態。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | data_object |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Data Governance Contract |
| update_frequency | 随時 |
| owner | Data owner / System owner |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 操作別権限。auditは限定参照 |
| status | Proposed |
| aliases | ambiguous |
| exclusions | — |
| edge_cases | — |
| decision_required | — |
| effective_from | — |
| version | 1.0-draft |

## 隔離 (`quarantine`)

| field | value |
|---|---|
| term_id | data_governance.quarantine |
| technical_key | quarantine |
| japanese_name | 隔離 |
| display_name | 隔離 |
| category | data_governance |
| definition | validationまたはmapping不合格のdataを本集計から分離した状態・領域。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | data_object |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Data Governance Contract |
| update_frequency | 随時 |
| owner | Data owner / System owner |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 操作別権限。auditは限定参照 |
| status | Proposed |
| aliases | quarantine |
| exclusions | — |
| edge_cases | — |
| decision_required | — |
| effective_from | — |
| version | 1.0-draft |

## 検証エラー (`validation_error`)

| field | value |
|---|---|
| term_id | data_governance.validation_error |
| technical_key | validation_error |
| japanese_name | 検証エラー |
| display_name | 検証エラー |
| category | data_governance |
| definition | 取込または契約を拒否する重大なvalidation違反。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | data_object |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Data Governance Contract |
| update_frequency | 随時 |
| owner | Data owner / System owner |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 操作別権限。auditは限定参照 |
| status | Proposed |
| aliases | validation error |
| exclusions | — |
| edge_cases | — |
| decision_required | — |
| effective_from | — |
| version | 1.0-draft |

## 警告 (`warning`)

| field | value |
|---|---|
| term_id | data_governance.warning |
| technical_key | warning |
| japanese_name | 警告 |
| display_name | 警告 |
| category | data_governance |
| definition | 処理継続は可能だが確認を要する非blocking事象。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | data_object |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Data Governance Contract |
| update_frequency | 随時 |
| owner | Data owner / System owner |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 操作別権限。auditは限定参照 |
| status | Proposed |
| aliases | warning |
| exclusions | — |
| edge_cases | — |
| decision_required | — |
| effective_from | — |
| version | 1.0-draft |

## 重複 (`duplicate`)

| field | value |
|---|---|
| term_id | data_governance.duplicate |
| technical_key | duplicate |
| japanese_name | 重複 |
| display_name | 重複 |
| category | data_governance |
| definition | 同一business keyまたはsource identityが複数回現れる状態。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | data_object |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Data Governance Contract |
| update_frequency | 随時 |
| owner | Data owner / System owner |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 操作別権限。auditは限定参照 |
| status | Proposed |
| aliases | duplicate |
| exclusions | — |
| edge_cases | — |
| decision_required | — |
| effective_from | — |
| version | 1.0-draft |

## チェックサム (`checksum`)

| field | value |
|---|---|
| term_id | data_governance.checksum |
| technical_key | checksum |
| japanese_name | チェックサム |
| display_name | チェックサム |
| category | data_governance |
| definition | source bytesまたはcanonical payloadの同一性を検証するdigest。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | data_object |
| unit | digest |
| timezone | Asia/Tokyo |
| source_of_truth | Data Governance Contract |
| update_frequency | 随時 |
| owner | Data owner / System owner |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 操作別権限。auditは限定参照 |
| status | Proposed |
| aliases | checksum |
| exclusions | — |
| edge_cases | — |
| decision_required | — |
| effective_from | — |
| version | 1.0-draft |

## 監査記録 (`audit`)

| field | value |
|---|---|
| term_id | data_governance.audit |
| technical_key | audit |
| japanese_name | 監査記録 |
| display_name | 監査記録 |
| category | data_governance |
| definition | actor、action、resource、result、timestamp、correlationを追跡するimmutable記録。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | data_object |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Data Governance Contract |
| update_frequency | 随時 |
| owner | Data owner / System owner |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 監査・system管理者に限定 |
| status | Proposed |
| aliases | audit |
| exclusions | — |
| edge_cases | — |
| decision_required | — |
| effective_from | — |
| version | 1.0-draft |

## 修正理由 (`correction_reason`)

| field | value |
|---|---|
| term_id | data_governance.correction_reason |
| technical_key | correction_reason |
| japanese_name | 修正理由 |
| display_name | 修正理由 |
| category | data_governance |
| definition | 訂正を必要とした業務理由の承認済みcodeと補足。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | data_object |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Data Governance Contract |
| update_frequency | 随時 |
| owner | Data owner / System owner |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 操作別権限。auditは限定参照 |
| status | Proposed |
| aliases | correction reason |
| exclusions | — |
| edge_cases | — |
| decision_required | — |
| effective_from | — |
| version | 1.0-draft |

## 承認者 (`approved_by`)

| field | value |
|---|---|
| term_id | data_governance.approved_by |
| technical_key | approved_by |
| japanese_name | 承認者 |
| display_name | 承認者 |
| category | data_governance |
| definition | 特定versionを承認したcanonical principal ID。表示名のみを保存しない。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | data_object |
| unit | principal_id |
| timezone | Asia/Tokyo |
| source_of_truth | Data Governance Contract |
| update_frequency | 随時 |
| owner | Data owner / System owner |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 操作別権限。auditは限定参照 |
| status | Proposed |
| aliases | approved by |
| exclusions | — |
| edge_cases | — |
| decision_required | — |
| effective_from | — |
| version | 1.0-draft |

## データオーナー (`data_owner`)

| field | value |
|---|---|
| term_id | data_governance.data_owner |
| technical_key | data_owner |
| japanese_name | データオーナー |
| display_name | データオーナー |
| category | data_governance |
| definition | 定義・品質・access・変更承認に最終責任を持つ業務role。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | data_object |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Data Governance Contract |
| update_frequency | 随時 |
| owner | Data owner / System owner |
| consumers | 全IDEA NOV OSアプリ |
| access_level | 操作別権限。auditは限定参照 |
| status | Proposed |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | — |
| effective_from | — |
| version | 1.0-draft |

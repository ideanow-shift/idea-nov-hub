# Data Status Model

| UI項目 | technical_key | 必要原本 | 現在の取得元 | 判定 | 加工方法 | 更新頻度 | 信頼度 | 未確定事項 |
|---|---|---|---|---|---|---|---|---|
| 対象月 | target_month | source period | 各monthly CSV/P&Lにperiod/monthあり | Available | YYYY-MMへ正規化 | 月次 | High | 営業月境界 |
| 入力済み店舗数 | submitted_store_count | import batch＋expected stores | local validator row receipts。永続batchなし | Derivable | valid unique store_idをCOUNT | 取込時 | Medium-Low | 名称matchingをCore IDへ置換 |
| 未入力店舗数 | missing_store_count | active store set＋batch | active storesとlocal rows | Derivable | expected active store_id MINUS submitted | 取込時 | Medium-Low | 対象20店舗の正式集合 |
| 検証済み店舗数 | validated_store_count | validation result | local validatorsのvalid rows | Derivable | 全required datasetを通過したstore_idをCOUNT | 検証時 | Medium-Low | required dataset集合 |
| エラー店舗数 | error_store_count | validation result | validator error categoriesあり | Derivable | validation時にstore_id付きerror resultを保持してCOUNT | 検証時 | Medium-Low | 現状receiptはerror時rowsを捨てるため直接取得不可 |
| 最終更新日時 | last_updated_at | persistent import/audit | finance source documentsにimported_at、店舗local receiptにはtimestampなし | Unknown | dataset別MAX(imported_at) | 随時 | Low | 店舗売上の永続batch |
| 速報 | flash_status | record state | 店舗売上のpersistent stateなし | Unavailable | state machineが必要 | 随時 | High | 速報条件 |
| 暫定 | provisional_status | record state | 店舗売上のpersistent stateなし | Unavailable | state machineが必要 | 随時 | High | 速報との差 |
| 検証済み | validated_status | validation result | local validator categories | Derivable | required validationsの合格を集約 | 検証時 | Medium | 永続化と承認分離 |
| 確定 | confirmed_status | 経理/営業承認 | 法人financeにlatestClosedMonth候補、店舗状態なし | Unknown | 承認versionを参照 | 月次 | Low | store close/承認source |
| 締め済み | closed_status | monthly close record | 店舗close tableなし | Unknown | store×period close recordが必要 | 月次 | Low | close owner・再open |
| 再修正 | revised_status | correction version | local correction contractのみ。永続versionなし | Unavailable | correction lineageと新versionが必要 | 随時 | High | 承認・再締め |

## Recommended state order

`not_submitted -> submitted -> validation_error|validated -> provisional -> confirmed -> closed -> reopened -> revised -> closed`

Version1 prototypeでは実装済みlocal validationの結果だけを「検証済み候補」と表示し、経理/営業の承認済み・締め済みと混同しない。店舗売上のpersistent import batch、store-period status、correction lineageは未実装。

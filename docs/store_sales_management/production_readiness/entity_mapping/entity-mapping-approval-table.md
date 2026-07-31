# Entity Mapping承認表

## 判定

第13期の38 source entityを承認単位とする。名称一致だけで正式承認せず、Core UUID、法人帰属、effective periodは正式証跡がない限りTBDとした。

完全な28列は[CSV](./entity-mapping-approval-candidates.csv)および[JSON](./entity-mapping-approval-candidates.json)を正本候補とする。

| mapping_no | source_entity_code | source_entity_name | normalized_name | entity_type | direct_or_fc | confidence | final_status | core_uuid | valid_from | unresolved_question |
|---|---|---|---|---|---|---|---|---|---|---|
| EM-001 | YAYOI-001 | 全体(合計) | 全体(合計) | accounting_source_entity | unknown | low | blocked | TBD | TBD | 弥生は正式法人名・Core候補はブランド表記でありUUID未取得 |
| EM-002 | YAYOI-002 | 本部 | 本部 | accounting_source_entity | unknown | low | blocked | TBD | TBD | Core department単体へ割り当てない |
| EM-003 | YAYOI-003 | 本部･営業 | 本部･営業 | department | unknown | high | proposed | TBD | TBD | 会計部門とCore部門の有効期間確認 |
| EM-004 | YAYOI-004 | 本部･教育(合計) | 本部･教育(合計) | accounting_source_entity | unknown | low | blocked | TBD | 2024-09-01 | 教育部内訳のrollup |
| EM-005 | YAYOI-005 | 教育･アカデミー | 教育･アカデミー | department | unknown | medium | under_review | TBD | 2024-09-01 | Coreにsubdepartmentがあるか未確認 |
| EM-006 | YAYOI-006 | 本部･教育(共通) | 本部･教育(共通) | accounting_source_entity | unknown | low | blocked | TBD | 2024-09-01 | 共通費を教育部へ含めるか確認 |
| EM-007 | YAYOI-007 | 本部･総務 | 本部･総務 | department | unknown | high | proposed | TBD | TBD | 総務と人事を会計上分離していない可能性 |
| EM-008 | YAYOI-008 | 本部･経理 | 本部･経理 | department | unknown | high | proposed | TBD | TBD | UUID未取得 |
| EM-009 | YAYOI-009 | KYARA HALF | KYARA HALF店 | store | Direct | high | proposed | TBD | TBD | 法人帰属・直営FC区分・営業期間未確認 |
| EM-010 | YAYOI-010 | BASSA新所沢店 | 新所沢店 | store | unknown | medium | under_review | TBD | TBD | FC新所沢との同一店舗・移管関係を確認 |
| EM-011 | YAYOI-011 | BASSA所沢店 | 所沢店 | store | Direct | high | proposed | TBD | TBD | Core実値と法人帰属を未取得 |
| EM-012 | YAYOI-012 | BASSA久米川店 | 久米川店 | store | unknown | medium | under_review | TBD | TBD | FC久米川との同一店舗・移管関係を確認 |
| EM-013 | YAYOI-013 | BASSA国分寺店 | 国分寺店 | store | unknown | medium | under_review | TBD | TBD | FC国分寺との同一店舗・移管関係を確認 |
| EM-014 | YAYOI-014 | BASSA高田馬場店 | 高田馬場店 | store | Direct | high | proposed | TBD | TBD | Core実値と法人帰属を未取得 |
| EM-015 | YAYOI-015 | BASSA上石神井店 | 上石神井店 | store | Direct | high | proposed | TBD | TBD | Core実値と法人帰属を未取得 |
| EM-016 | YAYOI-016 | BASSA保谷店 | 保谷店 | store | Direct | high | proposed | TBD | TBD | Core実値と法人帰属を未取得 |
| EM-017 | YAYOI-017 | BASSA東大和店 | 東大和店 | store | Direct | high | proposed | TBD | TBD | Core実値と法人帰属を未取得 |
| EM-018 | YAYOI-018 | BASSA下井草店 | 下井草店 | store | Direct | high | proposed | TBD | TBD | Core実値と法人帰属を未取得 |
| EM-019 | YAYOI-019 | BASSA石神井公園店 | 石神井公園店 | store | Direct | high | proposed | TBD | TBD | Core実値と法人帰属を未取得 |
| EM-020 | YAYOI-020 | BASSA東久留米店 | 東久留米店 | store | unknown | medium | under_review | TBD | TBD | FC東久留米との同一店舗・移管関係を確認 |
| EM-021 | YAYOI-021 | BASSA江古田店 | 江古田店 | store | Direct | high | proposed | TBD | TBD | Core実値と法人帰属を未取得 |
| EM-022 | YAYOI-022 | BASSA花小金井店 | 花小金井店 | store | unknown | medium | under_review | TBD | TBD | FC花小金井との同一店舗・移管関係を確認 |
| EM-023 | YAYOI-023 | BASSAアネックス店 | ANNEX店 | store | Direct | medium | under_review | TBD | TBD | Core実値と法人帰属を未取得 |
| EM-024 | YAYOI-024 | BASSA池袋店 | 池袋店 | store | Direct | high | proposed | TBD | TBD | Core実値と法人帰属を未取得 |
| EM-025 | YAYOI-025 | BASSA野方店 | 野方店 | store | Direct | high | proposed | TBD | TBD | Core実値と法人帰属を未取得 |
| EM-026 | YAYOI-026 | BASSA立川店 | 立川店 | store | Direct | high | proposed | TBD | 2025-09-01 | FC立川とのeffective period重複を確認 |
| EM-027 | YAYOI-027 | EC事業部 | EC事業部 | department | unknown | medium | under_review | TBD | 2025-09-01 | department UUIDと会計期間中の組織状態未確認 |
| EM-028 | YAYOI-028 | FC(合計) | FC(合計) | accounting_source_entity | unknown | low | blocked | TBD | TBD | 法人ではなく会計部門rollupの可能性 |
| EM-029 | YAYOI-029 | FC新所沢 | 新所沢店 | store | FC | low | blocked | TBD | TBD | BASSA新所沢店との重複候補 |
| EM-030 | YAYOI-030 | FC国分寺 | 国分寺店 | store | FC | low | blocked | TBD | TBD | BASSA国分寺店との重複候補 |
| EM-031 | YAYOI-031 | FC鷺ノ宮 | 鷺ノ宮店 | store | FC | medium | under_review | TBD | TBD | Core正式店舗名と法人未確認 |
| EM-032 | YAYOI-032 | FC久米川 | 久米川店 | store | FC | low | blocked | TBD | TBD | BASSA久米川店との重複候補 |
| EM-033 | YAYOI-033 | FC花小金井 | 花小金井店 | store | FC | low | blocked | TBD | TBD | BASSA花小金井店との重複候補 |
| EM-034 | YAYOI-034 | FC東久留米 | 東久留米店 | store | FC | low | blocked | TBD | 2024-09-01 | BASSA東久留米店との重複候補 |
| EM-035 | YAYOI-035 | FC立川 | 立川店 | store | FC | low | blocked | TBD | 2024-09-01 | BASSA立川店との移管・期間重複候補 |
| EM-036 | YAYOI-036 | FCロアネ | Roane店 | store | FC | medium | under_review | TBD | 2025-09-01 | Core正式店舗名と法人未確認 |
| EM-037 | YAYOI-037 | FC(共通) | FC(共通) | accounting_source_entity | unknown | low | blocked | TBD | TBD | FC各店へ配賦するか別表示か未決定 |
| EM-038 | YAYOI-038 | 全体(共通) | 全体(共通) | accounting_source_entity | unknown | low | blocked | TBD | TBD | 全社共通費の配賦rule未決定 |

## 承認区分

- A 一括承認候補: high / proposed 15件。source名称と候補identityの確認を一括化できるが、UUID承認を意味しない。
- B 要確認: medium / under_review 10件。
- C Blocking: low / blocked 13件。

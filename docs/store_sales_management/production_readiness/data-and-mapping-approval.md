# Data and Entity Mapping Approval

## Purpose

弥生38 entity候補をCore masterへ安全に対応付ける承認台帳とする。UUIDは推測しない。

## Current State

38件すべて`unknown`。Core UUID、法人帰属、Direct/FC、FC法人、effective periodの正式承認はない。

## Target State

全38件についてAccounting、Core Master、Sales、Managementが承認し、有効期間とsuccessorを固定する。集計nodeはCore UUIDへ無理に割り当てない。

## Approval Table

共通値: `source_system=yayoi_excel`、`core_uuid=TBD`、承認4列=`unknown`。

| source_entity_code | source_entity_name | entity_type | legal_entity_candidate | store_candidate | department_candidate | direct_or_fc | fc_company_candidate | valid_from | valid_to | successor_entity | status | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| YAYOI-001 | 全体(合計) | legal_entity_rollup | IDEA NOV候補 | - | - | TBD | TBD | TBD | TBD | TBD | unknown | 正式法人名・UUID要確認 |
| YAYOI-002 | 本部 | accounting_rollup | TBD | - | - | TBD | - | TBD | TBD | TBD | unknown | Core単体へ割当禁止候補 |
| YAYOI-003 | 本部･営業 | department | TBD | - | 営業部 | - | - | TBD | TBD | TBD | unknown | 有効期間要確認 |
| YAYOI-004 | 本部･教育(合計) | department_rollup | TBD | - | 教育部rollup | - | - | 2024-09-01 | TBD | TBD | unknown | 集計node |
| YAYOI-005 | 教育･アカデミー | department | TBD | - | 教育部候補 | - | - | 2024-09-01 | TBD | TBD | unknown | subdepartment有無 |
| YAYOI-006 | 本部･教育(共通) | shared_department | TBD | - | 教育部候補 | - | - | 2024-09-01 | TBD | TBD | unknown | 共通費rule |
| YAYOI-007 | 本部･総務 | department | TBD | - | 総務人事部 | - | - | TBD | TBD | TBD | unknown | 総務/人事分離 |
| YAYOI-008 | 本部･経理 | department | TBD | - | 経理部 | - | - | TBD | TBD | TBD | unknown | UUID未取得 |
| YAYOI-009 | KYARA HALF | store | TBD | KYARA HALF | - | TBD | TBD | TBD | TBD | TBD | unknown | 法人・営業期間 |
| YAYOI-010 | BASSA新所沢店 | store | TBD | BASSA新所沢店 | - | TBD | TBD | TBD | TBD | TBD | unknown | Core実値未取得 |
| YAYOI-011 | BASSA所沢店 | store | TBD | BASSA所沢店 | - | TBD | TBD | TBD | TBD | TBD | unknown | Core実値未取得 |
| YAYOI-012 | BASSA久米川店 | store | TBD | BASSA久米川店 | - | TBD | TBD | TBD | TBD | TBD | unknown | Core実値未取得 |
| YAYOI-013 | BASSA国分寺店 | store | TBD | BASSA国分寺店 | - | TBD | TBD | TBD | TBD | TBD | unknown | Core実値未取得 |
| YAYOI-014 | BASSA高田馬場店 | store | TBD | BASSA高田馬場店 | - | TBD | TBD | TBD | TBD | TBD | unknown | Core実値未取得 |
| YAYOI-015 | BASSA上石神井店 | store | TBD | BASSA上石神井店 | - | TBD | TBD | TBD | TBD | TBD | unknown | Core実値未取得 |
| YAYOI-016 | BASSA保谷店 | store | TBD | BASSA保谷店 | - | TBD | TBD | TBD | TBD | TBD | unknown | Core実値未取得 |
| YAYOI-017 | BASSA東大和店 | store | TBD | BASSA東大和店 | - | TBD | TBD | TBD | TBD | TBD | unknown | Core実値未取得 |
| YAYOI-018 | BASSA下井草店 | store | TBD | BASSA下井草店 | - | TBD | TBD | TBD | TBD | TBD | unknown | Core実値未取得 |
| YAYOI-019 | BASSA石神井公園店 | store | TBD | BASSA石神井公園店 | - | TBD | TBD | TBD | TBD | TBD | unknown | Core実値未取得 |
| YAYOI-020 | BASSA東久留米店 | store | TBD | BASSA東久留米店 | - | TBD | TBD | TBD | TBD | TBD | unknown | Core実値未取得 |
| YAYOI-021 | BASSA江古田店 | store | TBD | BASSA江古田店 | - | TBD | TBD | TBD | TBD | TBD | unknown | Core実値未取得 |
| YAYOI-022 | BASSA花小金井店 | store | TBD | BASSA花小金井店 | - | TBD | TBD | TBD | TBD | TBD | unknown | Core実値未取得 |
| YAYOI-023 | BASSAアネックス店 | store | TBD | BASSAアネックス店 | - | TBD | TBD | TBD | TBD | TBD | unknown | Core実値未取得 |
| YAYOI-024 | BASSA池袋店 | store | TBD | BASSA池袋店 | - | TBD | TBD | TBD | TBD | TBD | unknown | Core実値未取得 |
| YAYOI-025 | BASSA野方店 | store | TBD | BASSA野方店 | - | TBD | TBD | TBD | TBD | TBD | unknown | Core実値未取得 |
| YAYOI-026 | BASSA立川店 | store | TBD | BASSA立川店 | - | TBD | TBD | 2025-09-01 | TBD | TBD | unknown | 第13期から |
| YAYOI-027 | EC事業部 | department | TBD | - | EC事業部 | - | - | 2025-09-01 | TBD | TBD | unknown | UUID・組織状態 |
| YAYOI-028 | FC(合計) | franchise_rollup | TBD | - | - | FC | TBD | TBD | TBD | TBD | unknown | 法人でなくrollup候補 |
| YAYOI-029 | FC新所沢 | franchise_store | TBD | BASSA新所沢店候補 | - | FC | TBD | TBD | TBD | TBD | unknown | BASSA sheetとの関係 |
| YAYOI-030 | FC国分寺 | franchise_store | TBD | BASSA国分寺店候補 | - | FC | TBD | TBD | TBD | TBD | unknown | BASSA sheetとの関係 |
| YAYOI-031 | FC鷺ノ宮 | franchise_store | TBD | 鷺ノ宮候補 | - | FC | TBD | TBD | TBD | TBD | unknown | 正式店舗名不明 |
| YAYOI-032 | FC久米川 | franchise_store | TBD | BASSA久米川店候補 | - | FC | TBD | TBD | TBD | TBD | unknown | BASSA sheetとの関係 |
| YAYOI-033 | FC花小金井 | franchise_store | TBD | BASSA花小金井店候補 | - | FC | TBD | TBD | TBD | TBD | unknown | BASSA sheetとの関係 |
| YAYOI-034 | FC東久留米 | franchise_store | TBD | BASSA東久留米店候補 | - | FC | TBD | 2024-09-01 | TBD | TBD | unknown | 第12期から |
| YAYOI-035 | FC立川 | franchise_store | TBD | BASSA立川店候補 | - | FC | TBD | 2024-09-01 | TBD | TBD | unknown | 第12期から |
| YAYOI-036 | FCロアネ | franchise_store | TBD | ロアネ候補 | - | FC | TBD | 2025-09-01 | TBD | TBD | unknown | 正式店舗名不明 |
| YAYOI-037 | FC(共通) | shared_department | TBD | - | - | FC | TBD | TBD | TBD | TBD | unknown | 配賦rule未決定 |
| YAYOI-038 | 全体(共通) | shared_department | TBD | - | - | TBD | TBD | TBD | TBD | TBD | unknown | 全社共通費rule |

以下は上表と`source_entity_code`で結合する承認列であり、2表を合わせて指定された全列を構成する。

| source_system | source_entity_code | core_uuid | accounting_approved | master_owner_approved | sales_approved | management_approved |
|---|---|---|---|---|---|---|
| yayoi_excel | YAYOI-001 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-002 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-003 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-004 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-005 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-006 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-007 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-008 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-009 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-010 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-011 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-012 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-013 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-014 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-015 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-016 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-017 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-018 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-019 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-020 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-021 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-022 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-023 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-024 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-025 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-026 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-027 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-028 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-029 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-030 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-031 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-032 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-033 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-034 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-035 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-036 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-037 | TBD | unknown | unknown | unknown | unknown |
| yayoi_excel | YAYOI-038 | TBD | unknown | unknown | unknown | unknown |

## Confirmed Decisions

UUIDを生成・推測しない。名称一致だけでapprovedにしない。effective periodをversion管理する。

## Proposed Decisions

Accounting→Core Master→Sales→Managementの順で承認し、4者完了時だけ`approved`。

## Unknowns

全UUID、legal entity、Direct/FC、FC法人、旧新entity関係、共通費配賦。

## Blocking Items

38件の承認未完了。mapping 100%未満ではAccounting publishおよびProduction Goを禁止。

## Required Approvers

Accounting Approver、Core Master Owner、Sales Owner、Management Approver。FC行はFC Representative。

## Evidence／Source

- [Entity mapping候補](../../accounting/yayoi-entity-mapping.csv)
- [Effective periods](../../accounting/yayoi-entity-effective-periods.csv)

## Exit Criteria

38/38件で必須列と4承認が揃い、重複・gap・越境negative testが合格する。

# 04 Store Sales Decision Items

ライブDBは権限・Core Masterの確認対象であり、売上原本の業務定義はDBから確定できない。以下は実装前の人間判断である。

| ID | Decision | 選択肢/確認内容 | 推奨案 | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| SS-01 | 正式原本 | POS、CSV、会計帳票、既存Management | 一つのtransaction/line sourceを正本に選ぶ | 営業+経理 | Blocked |
| SS-02 | 税 | 税込/税抜、税率、端数、軽減税率 | 原本値を保持し純売上はversion式で導出 | 経理 | Needs Decision |
| SS-03 | 値引 | 明細/取引配賦、クーポン、ポイント | 原値を保持し配賦規則をversion化 | 営業+経理 | Needs Decision |
| SS-04 | 取消 | voidと売上未成立の境界 | 原取引参照イベント | 営業 | Needs Decision |
| SS-05 | 返品 | 当日/過日、部分返品、在庫との関係 | 原取引参照の負額調整 | 営業+経理 | Needs Decision |
| SS-06 | 訂正 | 誰が、いつ、過月をどう直すか | 上書きせず新version+reason+approver | 営業+経理 | Needs Decision |
| SS-07 | 締め | 日次/月次、再open、承認者 | store-periodのdigest付きclose | 営業+経理 | Blocked |
| SS-08 | 営業日 | timezone、境界時刻、休業日 | Asia/Tokyo + 店舗別境界時刻 | 営業 | Needs Decision |
| SS-09 | Core Read Adapter | ID、as-of、cache、version、SLO | public 3表のread-only projection | CTO/Core owner | Needs Decision |
| SS-10 | Snapshot | 粒度、immutable、訂正、法人経営連携 | store×period×version、digest付き | 営業+経理+法人経営 | Blocked |
| SS-11 | role/scope/action | 店長、Area、営業、経理、経営 | roleだけでなくstore UUID scope | 各owner+Security | Blocked |
| SS-12 | negative test | 他店ID、偽actor、inactive、close後write | 100% denyをGate化 | Security/QA | Blocked |
| SS-13 | 検証環境 | production非書込、fixture、token、Storage | 独立sandbox + synthetic data | CTO | Blocked |
| SS-14 | rollback owner | route、writer flag、snapshot停止 | 営業運用ownerと技術ownerを指名 | CTO+営業 | Blocked |

## Core Master前提

public.employees/stores/corporationsを当面の物理正本候補とする。core同名表は削除せず非正本・将来モデル候補とし、新規直接参照を増やさない。Core Read Adapterはpublic物理列を契約型へ変換し、consumerへschema名を露出しない。

## Goに必要な受入証跡

- source sampleと件数/金額digestのreconciliation。
- 税・値引・取消・返品・訂正を含むgolden fixtures。
- close/reopenの状態遷移と権限表。
- AdapterのID/as-of/version contract。
- Snapshot再計算で同一digest。
- role/scope/actionのpositive/negative test。
- sandboxとrollback rehearsal記録。


# IDEA NOV OS システムポートフォリオ

基準日: 2026-07-28。対象は本リポジトリ、同一ワークスペース内の関連チェックアウト、既存監査資料、NOV HUB導線。ライブDB・各本番画面・アクセス不能な別リポジトリは未確認。完成度は業務フロー、運用証跡、認証、DB、テスト、重大未完成を総合した参考値である。

## Core Platform

| system | status | completion | production | owner | repository | core dependency | next action |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| Supabase Core Platform | Production | 82% | Yes | Core DB owner（要氏名確認） | `ideanow-shift/idea-nov-hub` | - | public/core二重マスタのADR確定 |
| Core Master管理 | Stable | 84% | Yes | HUB/Core DB owner | `ideanow-shift/idea-nov-hub` | employees, stores, roles | ライブRLS/GRANT再確認 |
| Firebase Auth | Production | 85% | Yes | Auth platform owner（要確認） | 設定はHUB repo | employee UID mapping | UID重複・email fallback監査 |
| Notification Engine | Active Development | 65% | Partial | OS/Core owner | `ideanow-shift/idea-nov-hub` | notifications, destinations | 配信責任と再送契約を確定 |

## Portal

| system | status | completion | production | owner | repository | core dependency | next action |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| NOV HUB | Production | 92% | Yes | HUB owner | `ideanow-shift/idea-nov-hub` | Core Master/Auth/portal_apps | 本番カードとroleを定期監査 |
| NOV Navi | Active Development | 72% | Partial | HUB owner | 同上 | HUB session/Core APIs | provider未接続領域を順次接続 |

## Communication

| system | status | completion | production | owner | repository | core dependency | next action |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| IDEA LINK／サンクスコイン | Production | 90% | Yes | IDEA LINK owner（要確認） | 同上（別履歴あり） | employees, roles | THANKS旧カードを整理 |
| 1on1 MTG | Unknown | 20% | Unknown | 未確認 | 未確認 | employee/manager候補 | 実体・URL・正本を確認 |

## Management

| system | status | completion | production | owner | repository | core dependency | next action |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| 法人経営管理 | Active Development | 70% | Partial | 経営/経理（要確認） | 同上 | corporations/stores | 会計正本と締めworkflow確定 |
| 店舗営業管理 | Redesign | 48% | Partial/Unknown | 営業部（要確認） | 未確認/一部HUB | stores/employees | 重複画面を統合設計 |
| Management Platform | Stable | 78% | Yes候補 | 管理部門（要確認） | 同上 | employee/store | 権限・写真Storageをライブ確認 |
| 環境整備／マネジメントチェック | Stable | 76% | Yes候補 | 管理部門（要確認） | 同上 | employee/store | Management Platformとの名称統一 |
| タスク管理 | Active Development | 58% | Partial | 本部（要確認） | 同上 | employees/roles | Decision Hubとの境界確定 |
| Decision Hub | Active Development | 62% | Partial | 経営/HUB（要確認） | 同上 | actor/scope | 認証transport阻害を解消 |

## HR

| system | status | completion | production | owner | repository | core dependency | next action |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| 現職者管理 | Redesign | 45% | Partial/Unknown | 人事（要確認） | 同上＋実体未確認 | employees/assignments | 求人・マスタとの境界再定義 |
| 人財投資管理 | Active Development | 68% | Partial | 人事（要確認） | 同上 | employees/stores | NOV Talentとの重複整理 |

## Recruitment

| system | status | completion | production | owner | repository | core dependency | next action |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| NOV Talent／求人管理 | Active Development | 74% | Partial | 採用担当（要確認） | 同上 | employees/stores/job types | write API・運用責任を本番確定 |

## Attendance

| system | status | completion | production | owner | repository | core dependency | next action |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| 勤怠管理 | Stable | 80% | Yes候補 | 店舗運営（要確認） | 別repo未確認 | employee/store | URL token/PINとGitHub正本を確認 |
| シフト管理 | Active Development | 72% | Yes候補 | 店舗運営（要確認） | `ideanow-shift/shift`候補 | employee/store | 勤怠とのデータ境界を固定 |

## Finance

| system | status | completion | production | owner | repository | core dependency | next action |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| Expense Hub／経費申請 | Stable | 86% | Yes | 経理（要確認） | `ideanow-shift/idea-nov-expense-hub`候補 | employee/store/corp | 通知・会計CSVの運用証跡確認 |
| 経理サポート管理 | Active Development | 67% | Partial | 経理（要確認） | 別checkoutあり、remote未確認 | employee/store | Expense Hubとの責任分界 |

## Education

| system | status | completion | production | owner | repository | core dependency | next action |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| IDEA NOV EDU／教育部Web | Active Development | 66% | Partial | 教育部（要確認） | 同上＋旧GAS | employee/store | DBカード旧GAS導線を確定 |

## Sales

| system | status | completion | production | owner | repository | core dependency | next action |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| 営業部Webアプリ | Unknown | 30% | Unknown | 営業部 | 未確認 | stores/sales | 実体・本番URL・データ正本確認 |
| 営業部⇔教育部DB | Planned | 25% | Unknown | 営業/教育 | 未確認 | employee/store | DBかアプリかを定義 |
| キャンペーン管理 | Unknown | 20% | Unknown | 営業部 | 未確認 | store/product | HUBカード以外の実体確認 |

## EC

| system | status | completion | production | owner | repository | core dependency | next action |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| EC・商品管理 | Unknown | 25% | Unknown | EC事業部 | 未確認 | product/store | repo・URL・在庫正本確認 |
| 棚卸し | Unknown | 25% | Unknown | 店舗/EC | 未確認 | product/store | 商品管理との重複確認 |

## Knowledge

| system | status | completion | production | owner | repository | core dependency | next action |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| 社内問い合わせ・ナレッジ窓口 | Active Development | 68% | Partial | NOV Navi owner | 同上 | employee/department | concierge APIの運用責任確定 |

## Automation

| system | status | completion | production | owner | repository | core dependency | next action |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| Instagram自動投稿 | Unknown | 20% | Unknown | 広報（要確認） | 未確認 | store/campaign候補 | 実体・Meta権限・Secret管理確認 |
| LINE WORKS連携 | Active Development | 70% | Partial/Yes | OS/Core owner | 同上 | notification destinations | bot権限・失敗再送・監査確認 |

## Shared UI

| system | status | completion | production | owner | repository | core dependency | next action |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| NOVA Design System | Stable | 78% | Yes | HUB/UI owner | 同上 | - | version/配布契約を明文化 |

## 総括

- 発見数は31（独立した業務システム、共通基盤、HUBカード実体不明項目を含む）。
- 高完成度: NOV HUB、IDEA LINK、Expense Hub、Firebase Auth、Core Platform/Core Master。
- 再構築優先: 店舗営業管理、現職者管理。完全再構築より正本・境界・認可の再定義が先。
- 実体不明: 1on1、営業部Web、キャンペーン、EC/商品、棚卸し、Instagram。
- 旧/重複: `THANKS` と `idea-link`、Management Platformと環境整備、タスク管理とDecision Hub、人財投資とNOV Talentの一部。


# 04 Application Boundaries

## 目標アーキテクチャ

```text
NOV HUB
  └─ Firebase Auth（本人認証）
       └─ 共通Gateway / Auth Adapter
            ├─ Core Master参照
            ├─ employee role/scope認可
            ├─ 法人経営管理Webアプリ
            ├─ 店舗営業管理Webアプリ
            ├─ 求人管理Webアプリ
            └─ 現職者管理Webアプリ
```

アプリを分ける理由はUIではなく、更新責任・機密性・リリース単位を分離するためである。DBを4つに分割する設計ではない。

## 責任境界

| アプリ | 書き込み責任 | 読み取り共有 | 明確な非責任 |
| --- | --- | --- | --- |
| 法人経営管理 | 財務取込、P/L・B/S・CF、分類、経費、締め、法人KPI | Core法人/店舗/スタッフ、店舗確定KPI | 店舗の日々の会計操作、候補者、労務PII |
| 店舗営業管理 | 店舗売上原票または取込、店舗KPI、運営チェック、施策、改善 | Core店舗/スタッフ/法人、勤怠・シフト集計、法人目標 | 法人B/S・CF、Core店舗基本情報、雇用契約 |
| 求人管理 | 候補者、応募、選考、見学、面接、内定、フェア、採用費用 | Core店舗/法人/職種、限定された採用担当staff | 入社後の人事更新、Core staffの直接作成 |
| 現職者管理 | 配属/雇用履歴、労務PII、契約、書類、人事手続 | Core staff/store/corporation、onboarding case、勤怠/評価/教育summary | 候補者ファネル、財務原票、勤怠打刻原本 |

## 共有情報の契約

| Producer | Consumer | 契約 |
| --- | --- | --- |
| Core Master | 全アプリ | ID、表示名、active、所属の承認済み現在値をread-only提供 |
| NOV HUB/Auth | 全アプリ | `employee_id`, Firebase subject, role keys, scopes, expiry, audience |
| 店舗営業 | 法人経営 | 店舗×営業日/月×指標の確定スナップショット、source、version |
| 法人経営 | 店舗営業 | 予算、法人目標、承認済み分類、締め状態 |
| 求人 | 現職者 | onboarding case。候補者全履歴ではなく入社に必要な承認済み情報 |
| 現職者 | Core Master | 入社/所属/退職の変更申請。直接UPDATEではない |
| 勤怠・シフト | 店舗営業/現職者 | 確定済み集計またはread model |
| 評価・教育 | 現職者 | 最新summary、完了状態、参照リンク。詳細原本は各システム |

## 同期方式

- MVPでは同一Supabase内のFKと権限制御されたView/RPCを優先する。
- アプリから他領域テーブルへの直接UPDATEは禁止する。
- 共有集計はViewまたはversion付きsnapshotにし、コピー元、集計時刻、締め状態を持つ設計候補とする。
- Core Master更新は専用の変更申請/承認APIを通す。今回そのDB変更は行わない。
- イベント連携を採る場合も、outbox/idempotency key/再実行監査の設計承認後に実装する。

## 認証と認可

### 本人認証

Firebase Authが本人を証明する。各アプリはtokenをURL queryやlocalStorageの恒久credentialとして扱わず、短寿命handoffまたはAuthorization headerで共通Gatewayへ渡す。

### employee解決

優先順はFirebase UIDの一意link、次に承認済みemail fallbackとする。`public.employees` と `core.employees` の両方から別IDを返す実装は禁止する。物理正本ADR成立までadapterで一系統に固定する。

### 業務認可

- HUBのカード表示は利便性のための一次フィルタ。
- 各APIはactive employee、role、scope、対象法人/店舗、操作種別を再検証。
- service_roleはEdge内部だけで保持し、ユーザー権限の代替にしない。
- 高機密HRデータは「同じ法人」だけで許可せず、本人/人事担当/監査等の明示権限を要求する。

## 現行からの切り出し単位

### Management App

- `finance` と財務dataopsは法人経営へ残す。
- `stores` と店舗KPI/チェック/施策を店舗営業へ移す。
- dataopsのうち店舗売上取込は店舗営業、財務分類・締めは法人経営に分ける。
- 共通コードとして残せるのはdesign system、auth client、API error、scope表示まで。業務stateを共有bundleに残さない。

### Talent / HR

- Talent dashboardと候補者ファネルは求人管理へ残す。
- onboarding caseを唯一の境界にする。
- HR backoffice previewは新現職者アプリへコード移植せず、要件の参考として凍結する。

## 独立デプロイ時の必須条件

1. app_id、audience、allowed originをアプリごとに固定。
2. NOV HUBの`portal_apps`とfallback一覧を同一リリースで切り替える。
3. 新旧両URLに同じ書き込み権限を同時付与しない。
4. Core Master adapter contract testを4アプリ共通で実行。
5. 監査ログにactor、app_id、entity、action、result、correlation IDを残す。
6. rollback時に旧導線を戻しても二重書き込みを再開しない。


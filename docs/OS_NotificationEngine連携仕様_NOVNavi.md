# OS Notification Engine連携仕様：NOV Navi部門問い合わせ

## 目的

NOV Naviで受け付けた部門問い合わせを、OS共通Notification Engineへ引き渡し、LINE WORKSなどの通知基盤で各部門へ届ける。

NOV Naviは問い合わせ業務履歴の正本を持ちます。通知先、通知本体、送信処理はOS共通基盤へ寄せます。

## 基本方針

- NOV NaviフロントからLINE WORKSへ直接送信しない
- LINE WORKS Secret、アクセストークン、チャンネルID解決ロジックをフロントへ出さない
- LINE WORKS通知先の正本は `os.notification_destinations`
- 通知本体の正本は `os.notifications`
- NOV Navi側の問い合わせ履歴は `public.concierge_department_inquiries`
- NOV Navi側の問い合わせルート定義は `public.concierge_department_routes`
- OS側送信処理はbackend / Edge Function / service_roleで実行する

## 役割分担

| 領域 | 正本 / 責務 |
| --- | --- |
| 問い合わせ履歴 | `public.concierge_department_inquiries` |
| 問い合わせルート | `public.concierge_department_routes` |
| 通知先 | `os.notification_destinations` |
| 通知本体 | `os.notifications` |
| LINE WORKS送信キュー | `os.line_works_notification_queue` またはOS側送信対象ビュー |
| 送信処理 | OS Notification Engine / backend / Edge Function |

## 推奨フロー

```text
スタッフがNOV Naviで問い合わせ
↓
concierge_department_inquiries に保存
  status = queued
↓
backend / Edge Function が queued を取得
↓
route_id から purpose を生成
  concierge.department_inquiry.{route_key}
↓
os.notification_destinations で通知先を解決
↓
os.notifications に通知作成
↓
concierge_department_inquiries.notification_id を更新
concierge_department_inquiries.status = notified
↓
Notification Engine が LINE WORKS へ送信
↓
失敗時は status = failed, notification_error を更新
対応完了時は status = resolved
```

## 通知先解決

Phase1では部署IDに厳密に紐づけず、global通知先として扱います。

```text
provider = line_works
target_type = global
target_id = null
purpose = concierge.department_inquiry.{route_key}
```

初期purpose:

| route_id | purpose |
| --- | --- |
| `hr` | `concierge.department_inquiry.hr` |
| `accounting` | `concierge.department_inquiry.accounting` |
| `education` | `concierge.department_inquiry.education` |
| `sales` | `concierge.department_inquiry.sales` |
| `fc` | `concierge.department_inquiry.fc` |
| `system` | `concierge.department_inquiry.system` |

将来、Core DBの部署管理が安定したら以下へ寄せます。

```text
target_type = department
target_id = public.departments.id
purpose = concierge.department_inquiry
```

部署に紐づかない横断窓口や臨時窓口は `global` のままでもよいです。

## NOV Navi側テーブル

### `public.concierge_department_routes`

NOV Navi画面上の問い合わせ導線を定義します。

主なカラム:

- `id`
- `department_name`
- `owner`
- `is_active`
- `sort_order`

LINE WORKSチャンネルIDは持ちません。

### `public.concierge_department_inquiries`

問い合わせ業務履歴の正本です。

主なカラム:

- `id`
- `route_id`
- `store_id`
- `employee_id`
- `phase1_login_id`
- `question_log_id`
- `subject`
- `inquiry_text`
- `status`
- `notification_id`
- `notification_error`
- `created_at`
- `updated_at`

## ステータス

| status | 意味 |
| --- | --- |
| `queued` | NOV Naviで問い合わせ保存済み。OS通知作成待ち |
| `notified` | `os.notifications` 作成済み |
| `failed` | 通知先解決または通知作成に失敗 |
| `resolved` | 本部側で対応完了 |
| `cancelled` | 取消 |

## エラー記録

`notification_error` には、backend側で機械的に判別できる文字列を保存します。

例:

- `notification_destination_not_configured`
- `notification_destination_lookup_failed`
- `notification_create_failed`
- `line_works_send_failed`

詳細ログはOS Notification Engine側の送信ログに保存します。

## NOV Navi APIの現状

`concierge-api` は以下を実装済みです。

- `createDepartmentInquiry`
- `listDepartmentRoutes`
- `listDepartmentInquiries`

現状は問い合わせ保存と通知先設定状態の確認まで対応しています。`os.notifications` 作成とLINE WORKS実送信はOS側実装対象です。

## OS側に実装してほしい処理

1. `public.concierge_department_inquiries` から `status = queued` を取得
2. `route_id` から `purpose = concierge.department_inquiry.{route_key}` を生成
3. `os.notification_destinations` から有効な通知先を解決
4. `os.notifications` に通知本体を作成
5. `concierge_department_inquiries.notification_id` を更新
6. 成功時 `status = notified`
7. 失敗時 `status = failed`, `notification_error` を更新
8. LINE WORKS送信はOS共通Provider側で処理

## 通知本文案

```text
【NOV Navi 問い合わせ】
宛先: {department_name}
店舗: {store_name or phase1_login_id}
件名: {subject}

{inquiry_text}

問い合わせID: {inquiry_id}
作成日時: {created_at}
```

## 禁止事項

- NOV Navi側でLINE WORKS Secretを保持しない
- NOV NaviフロントにLINE WORKSチャンネルID解決ロジックを持たせない
- NOV Navi専用テーブルを通知先正本にしない
- `route_id` のUUIDを `purpose` に直接入れない
- `job_types` など社員属性マスタをNOV Navi側で作らない

## 完了条件

- NOV Naviで問い合わせを作成できる
- 管理画面の問い合わせタブに表示される
- `os.notification_destinations` の設定有無を確認できる
- OS側処理により `os.notifications` が作成される
- `concierge_department_inquiries.notification_id` が更新される
- 通知成功時に `status = notified` になる
- 失敗時に `status = failed` と `notification_error` が残る

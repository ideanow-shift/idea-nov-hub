# HUB人事労務管理 分離設計

作成日: 2026-07-03  
対象: NOV HUB / Core DB / 人事労務管理  
状態: 設計レビュー反映済み・DDL未実行

## 目的

NOV HUBの社員マスタを、全アプリ共通で使う社員情報の入口として維持しつつ、人事労務・給与・税・保険・家族・住所・書類などの秘匿情報は別領域へ分離する。

通常のHUB社員マスタには秘匿情報を出さず、権限を持つ本部人事・労務担当・管理者のみが人事労務管理画面から扱えるようにする。

## Core DBレビュー結果

CORE側レビューでは以下の方針で承認済み。

- `public.employees` は全アプリ共通で使う社員プロフィール・所属・ログイン基盤とする
- 人事労務情報は `hr` schema へ分離する
- 全テーブルは原則 `employee_id references public.employees(id)` で社員に紐付ける
- HUB通常社員マスタには秘匿情報を表示しない
- `service_role` はフロントへ出さない
- 初期フェーズは Edge Function / backend + service_role 経由で扱う
- `hub_context` に人事労務の秘匿情報は含めない
- 閲覧ログ・変更ログを必須とする
- マイナンバー実番号は初期フェーズでは保存しない
- 添付書類は Supabase Storage private bucket + metadata table とする

## 情報の分離

### HUB社員マスタに残す共通情報

以下は全アプリ共通で利用するため、`public.employees` またはCore DBの既存共通マスタで管理する。

| 項目 | 正本 | 用途 |
| --- | --- | --- |
| 社員番号 | `public.employees` | 表示・検索・連携 |
| 氏名 | `public.employees` | 全アプリ表示 |
| 表示名 | `public.employees` | HUB / 各アプリ表示 |
| メールアドレス | `public.employees` / login credentials | ログイン・通知 |
| 所属店舗 | `public.stores` / assignment | 店舗別表示・権限 |
| 部署 | `public.departments` | 組織管理 |
| 役職 | `public.positions` | 組織上の責任 |
| 職種 | `public.job_types` | シフト・採用・教育分類 |
| 雇用形態 | `public.employees.employment_type` | 共通分類 |
| 就労ステータス | `public.employees.employment_status` | 現職・休職・退職等 |
| 休職区分 | `public.employees.leave_type` | 産休・育休等 |
| 入社日 | `public.employees` | 共通社員履歴 |
| 退職日 | `public.employees` | 共通社員履歴 |
| プロフィール画像 | `public.employee_profile_images` | 各アプリ表示 |
| ログイン可否 | `employee_login_credentials` | HUB / 各アプリ認証 |
| アプリ権限 | `public.roles` / `public.employee_roles` | 権限判定 |

### 人事労務側へ分離する秘匿情報

以下は通常のHUB社員マスタには表示しない。人事労務管理画面と専用APIで扱う。

| 項目 | 推奨配置 | 備考 |
| --- | --- | --- |
| 戸籍名 | `hr.employee_profiles` | 表示名・業務名とは分離 |
| 住所 | `hr.employee_addresses` | 住民税・書類送付等 |
| 緊急連絡先 | `hr.employee_emergency_contacts` | 労務専用 |
| 家族情報 | `hr.employee_family_members` | 秘匿情報 |
| 扶養情報 | `hr.employee_dependents` | 税・社保連携 |
| マイナンバー管理 | `hr.employee_my_number_status` 候補 | 初期は実番号非保存 |
| 通勤情報 | `hr.employee_commutes` | 交通費・労務 |
| 銀行口座 | `hr.employee_bank_accounts` | 給与支払 |
| 給与情報 | `hr.employee_payroll_profiles` 候補 | さらに権限分離候補 |
| 所得税 | `hr.employee_tax_profiles` | 税務 |
| 住民税 | `hr.employee_resident_tax` 候補 | 税務 |
| 社会保険 | `hr.employee_social_insurance` | 社保 |
| 労働保険 | `hr.employee_labor_insurance` | 労保・雇保 |
| 契約情報 | `hr.employee_contracts` | 雇用契約 |
| 前職情報 | `hr.employee_history` | 入社・労務 |
| 外国人区分 | `hr.employee_profiles` または専用table | 在留情報は秘匿 |
| 労務書類 | `hr.employee_documents` | Storage metadata |
| 労務メモ | `hr.employee_notes` 候補 | 閲覧権限注意 |

## 推奨DB構成

初期設計候補。

```text
hr.employee_profiles
hr.employee_addresses
hr.employee_emergency_contacts
hr.employee_family_members
hr.employee_dependents
hr.employee_commutes
hr.employee_bank_accounts
hr.employee_tax_profiles
hr.employee_social_insurance
hr.employee_labor_insurance
hr.employee_contracts
hr.employee_documents
hr.employee_history
hr.audit_logs
hr.change_logs
```

追加検討候補。

```text
hr.employee_my_number_status
hr.employee_payroll_profiles
hr.employee_resident_tax
hr.employee_notes
```

## 権限設計

初期ロール。

| role_key | 役割 |
| --- | --- |
| `hr.viewer` | 人事労務情報の閲覧のみ |
| `hr.staff` | 人事労務の通常編集 |
| `hr.admin` | 人事労務の管理・設定 |
| `super_admin` | 全体管理 |

将来分離候補。

| role_key | 役割 |
| --- | --- |
| `hr.payroll` | 給与・銀行・税情報の閲覧/編集 |
| `hr.sensitive_admin` | マイナンバー等の高秘匿領域 |

給与・銀行・マイナンバーは、通常の `hr.staff` からさらに分ける余地を残す。

## RLS / API方針

- `hr` schema の全テーブルはRLS有効
- Phase1は NOV HUB frontend から直接 `hr` tableを触らない
- `nov-hub-api` または専用Edge Function経由で読み書きする
- `service_role` はbackend側のみ
- フロント・GitHub Pages・hub_contextに秘匿情報やsecretを出さない
- 人事労務情報の閲覧・変更は必ず監査ログへ記録する

## マイナンバー方針

初期フェーズでは実番号を保存しない。

管理ステータスのみ扱う。

```text
not_collected
requested
collected
verified
archived
```

実番号を扱う場合は、別途Core DBレビュー必須。

必須条件:

- 暗号化
- 専用権限
- 閲覧ログ
- 変更ログ
- 削除/保管期限ルール
- backend経由のみ

## 添付ファイル方針

```text
Storage bucket: hr-employee-documents
metadata table: hr.employee_documents
```

方針:

- bucketはprivate
- signed URLはbackendで短寿命発行
- signed URLをDBへ保存しない
- 文書種別、社員ID、アップロード者、作成日時、更新日時をmetadataへ保存
- 閲覧・ダウンロードも監査ログ対象

## HUB画面方針

通常の `master-admin` 社員マスタは、共通社員情報に絞る。

人事労務は別画面として扱う。

候補URL:

```text
/master-admin/hr/
```

または

```text
/hr-admin/
```

### 画面構成案

```text
人事労務管理
  - 労働者名簿
  - 入社手続き
  - 労務手続き
  - 書類・添付
  - 給与・税・保険
  - 設定
```

社員詳細タブ案。

```text
概要
所属・雇用
連絡先
家族
マイナンバー
通勤
銀行
給与
社会保険・労働保険
住民税
契約・書類
履歴
```

## KOT参考UIから採用する考え方

KING OF TIME人事労務画面は以下の点を参考にする。

- 左に社員サマリー
- 右に詳細タブ
- 労働者名簿として一覧出力できる構成
- 項目カスタマイズ
- 入社手続き
- 給与明細・源泉徴収票・マイナンバー管理などの業務導線
- 電子申請や手続き一覧

ただし、HUBではNOVA Design Systemに合わせてUIを作り、KOT画面をそのままコピーしない。

## 実装フェーズ

### Phase 0: 設計固定

- 本資料をHUB設計資料として管理
- 項目分離表を確定
- DDLはまだ実行しない

### Phase 1: HUB画面整理

- 既存社員詳細画面を共通情報だけに整理
- 人事労務入口を追加
- 権限がないユーザーには人事労務入口を表示しない

### Phase 2: hr schema DDLレビュー

- DDL draft作成
- RLS方針作成
- Edge Function方針作成
- Core DBレビュー後にSQL投入

### Phase 3: 人事労務MVP

- 労働者名簿
- 住所・緊急連絡先
- 家族・扶養
- 通勤
- 契約・書類
- 変更ログ

### Phase 4: 高秘匿領域

- 銀行
- 給与
- 税
- 社保・労保
- マイナンバー管理ステータス

実番号保存はこの段階でも別途レビュー必須。

## まだ実行しないこと

- `hr` schema DDL投入
- 既存社員データの一括移行
- RLS policy作成
- Storage bucket作成
- マイナンバー実番号保存
- 給与・税・保険情報の保存開始

## 次にHUB側で作るもの

1. 人事労務画面のワイヤー案
2. 項目分離表の詳細版
3. `hr` schema DDL draft
4. 権限マトリクス
5. 閲覧ログ・変更ログ設計
6. マイナンバー非保存運用案


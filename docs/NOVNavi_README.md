# IDEA NOV HUB - NOV Navigator

NOV Navigatorは、IDEA NOV HUBの入口としてスタッフの自然言語質問を受け、必要な情報、申請フォーム、社内アプリへ案内するPhase1実装です。

スタッフ向けの画面表示は、短く覚えやすい `NOV Navi` を使います。設計資料、管理文脈、正式名称では `NOV Navigator` を使います。

## 起動

依存パッケージはありません。`index.html` をブラウザで開くと動作します。

## 現在の接続状態

2026-07-01時点で、Phase1の主要APIはSupabaseへ移行済みです。

`app.js` はSupabase Edge Function `concierge-api` を呼び出します。

```text
https://nkmxevmioczcmnldreyo.supabase.co/functions/v1/concierge-api
```

Supabase化済み:

- 店舗ログイン
- 回答ルール取得
- 質問ログ保存
- 回答評価保存
- 部門問い合わせ保存
- 部門問い合わせログ取得
- 管理画面ログ取得
- リンクマスタ取得
- 回答ルール追加
- ナレッジ更新履歴保存
- ナレッジ更新履歴取得

GAS Web Appとスプレッドシートは通常実行経路から外しています。現在の通常操作はSupabase Edge Functionと `concierge_` prefixテーブルを使います。

APIスモークテスト済み:

```text
login: ok
listAnswerRules: ok
listLogs: ok
listLinks: ok
listKnowledgeUpdates: ok
```

2026-07-01にEdge FunctionのPhase1認証を強化済みです。

- `login` 成功時に署名付き `sessionToken` を発行
- `appendLog` / `updateRating` / `listLogs` / `appendAnswerRule` / `appendKnowledgeUpdate` / `listKnowledgeUpdates` は `sessionToken` 必須
- 管理系APIは `admin=true` のセッションのみ許可
- `service_role` はEdge Function環境変数だけで使用し、フロントには出さない
- HUB統合後はこのPhase1トークン境界をFirebase Auth + employees.idへ差し替える

## 店舗ログイン

Phase1では店舗ID/PASSでログインします。

現在、本部ログインはSupabase `concierge_store_credentials` で認証します。

| 店舗 | 店舗ID | 店舗PASS |
| --- | --- | --- |
| 本部管理 | `honbu` | `nov-admin` |

## 実装範囲

- 店舗単位ログイン
- ChatGPT/Gemini風の会話UI
- クイックチップ
- NotebookLM応答表示のAdapter境界
- 質問履歴
- 回答評価
- ログ保存
- 本部向け管理画面
- 本部向けナレッジ管理入口
- 各部門への問い合わせ受付

## 部門問い合わせ / Notification Engine方針

総務問い合わせ、経理問い合わせなどの各部門問い合わせは、NOV Navi上で受け付け、Supabase `public.concierge_department_inquiries` に `queued` として保存します。

NOV Navi上の問い合わせ導線は `public.concierge_department_routes` で管理します。

LINE WORKSグループIDなどの通知先正本はNOV Navi専用テーブルに置きません。最終形ではOS共通の `os.notification_destinations`、または provider特化の `os.line_works_channel_mappings` で解決します。

通知先解決キーは `purpose = concierge.department_inquiry.{route_key}` です。

Phase1では問い合わせ履歴を保存し、`queued` として扱います。LINE WORKSへの実送信は、OS Notification EngineまたはHUB backend / Edge Functionから行います。

通知本体の正本は `os.notifications` です。NOV Navi側の `concierge_department_inquiries` は問い合わせ業務履歴の正本として残します。

管理画面では `部門問い合わせログ` として、問い合わせ本文、ステータス、OS通知先設定の有無を確認できます。

重要:

- LINE WORKSのBot秘密情報やアクセストークンはフロントへ出さない
- フロントは `createDepartmentInquiry` APIだけを呼ぶ
- NOV Navi側は `route_id` と問い合わせ履歴を持つ
- 通知先グループIDの正本はOS共通Notification Engine側に置く
- 実送信はEdge FunctionまたはHUB backend/service_roleで行う

追加DDL:

```text
supabase/concierge_20260701_department_inquiries.sql
```

LINE WORKS通知先をOS共通Notification Engineへ登録するテンプレート:

```text
supabase/concierge_notification_destinations_TEMPLATE.sql
```

## Adapter方針

`app.js` の `KnowledgeAdapter` がNotebookLM接続部分です。現在はPhase1用のモック応答ですが、HUB本体はこのAdapterだけを呼びます。

将来NotebookLM、Gemini、OpenAI、Enterprise AIへ切り替える場合も、`KnowledgeAdapter.ask()` の内部実装を差し替える設計です。UI、ログ、管理画面、認証処理はNotebookLMに直接依存しません。

## ナレッジ管理方針

本部社員はHUB内の管理画面から「ナレッジ管理」を操作します。

Phase1では、各部門の正本資料リンク、NotebookLM管理リンク、更新履歴を管理します。実運用ではGoogle Drive / Google Docs / PDFを正本資料にし、NotebookLMは裏側のナレッジエンジンとして参照します。

NotebookLMを直接の運用画面にせず、HUBを入口にすることで、将来Gemini、OpenAI、Enterprise AIへ切り替える場合も影響範囲をAdapter内に閉じます。

本部担当者の基本運用:

1. 正本資料を担当カテゴリのGoogle Driveフォルダに格納する
2. NotebookLM管理を開き、ソースを追加・更新する
3. NotebookLM内で想定質問を試して回答を確認する
4. NOV Naviで社員目線の質問をテストする
5. 問題なければ更新履歴に記録する

登録済みNotebookLM:

| 区分 | URL |
| --- | --- |
| `00_検証用` | `https://notebooklm.google.com/notebook/518da655-be3e-4c76-a323-8beb69c6f92d` |
| `01_スタッフサポート` | `https://notebooklm.google.com/notebook/0b22a0dd-d764-4380-8444-218683b4ee28` |
| `02_教育` | `https://notebooklm.google.com/notebook/e5e2efce-740b-493f-b708-f3108e7f0084` |
| `03_管理者` | `https://notebooklm.google.com/notebook/a6b01da9-00ea-4479-bb79-0b0fdd4300e6` |
| `04_FC` | `https://notebooklm.google.com/notebook/68e228cc-7580-4b34-92e9-0528cd81b187` |
| `05_経営` | `https://notebooklm.google.com/notebook/07976b34-98f5-4c8b-9da0-7e5d701a9b1a` |

登録済み正本資料フォルダ:

| 区分 | Google Drive URL |
| --- | --- |
| `00_検証用` | `https://drive.google.com/drive/folders/12LiVPQt_esYMtZ0t4qftxXXXyxeBJJeK?usp=drive_link` |
| `01_スタッフサポート` | `https://drive.google.com/drive/folders/188b_tkR04bOgXbbrfYJKeGXWLF87fWkl?usp=drive_link` |
| `02_教育` | `https://drive.google.com/drive/folders/1Zflkf2P_cmLwpmGLw6xujjWsy5zNJ4Wp?usp=drive_link` |
| `03_管理者` | `https://drive.google.com/drive/folders/1mRK3QKfJ9_2uwhf3Pz1yRxf1PhHbtOkB?usp=drive_link` |
| `04_FC` | `https://drive.google.com/drive/folders/1gwAgEh2AGxzXdy1Z_odz_1B0m0Yxvlb1?usp=drive_link` |
| `05_経営` | `https://drive.google.com/drive/folders/1xS4JzEndusMaClJtJ69g37TVLxFDgm_w?usp=drive_link` |

## 認証方針

`StoreAuthProvider` がPhase1の店舗ID/PASS認証を担当します。Firebase Authenticationへ移行する場合は、このProviderの実装を差し替えます。

店舗情報の正本はCore DBの `public.stores` です。NOV Navigatorでは `public.stores.id` を参照し、店舗名やエリアを重複正本化しません。

Phase1の店舗ID/PASSは `public.concierge_store_credentials` で管理します。

過去の店舗マスタスプレッドシートは移行元資料としてのみ扱います。現在の通常ログイン経路では参照しません。

店舗情報の正本はCore DB `public.stores` です。Phase1の店舗ID/PASSは `public.concierge_store_credentials` で管理します。

HUB統合後は、店舗ID/PASSではなくFirebase Authから `public.employees.firebase_uid -> public.employees.id` を解決し、`roles / employee_roles` で権限判定する方針です。

## 社員属性の扱い

NOV Navigatorでは社員属性を独自マスタ化しません。

社員・店舗・部署・役職・職種・権限はCore DBを正本として参照します。

| 属性 | 正本 |
| --- | --- |
| 社員 | `public.employees.id` |
| 店舗 | `public.stores.id` |
| 部署 | `public.departments.id` |
| 役職 | `public.positions.id` |
| 職種 | `public.job_types.id` 新設後 |
| 雇用形態 | `employees.employment_type` |
| 就労ステータス | `employees.employment_status` |
| 休職種別 | `employees.leave_type` |
| 権限 | `public.roles` / `public.employee_roles` |

表示名はCore DBから取得し、NOV Navigator側に重複正本を作りません。

## 質問ログ保存

質問ログはSupabase `public.concierge_question_logs` に保存します。

回答評価はSupabase `public.concierge_feedback` に保存します。

旧GAS実装では、ログ保存先スプレッドシート内に `NOV_質問ログ` シートを自動作成していました。現在は通常経路では使いません。

現在の保存先:

| 用途 | Supabase table |
| --- | --- |
| 質問ログ | `public.concierge_question_logs` |
| 回答評価 | `public.concierge_feedback` |
| ナレッジ更新履歴 | `public.concierge_knowledge_updates` |
| リンク管理 | `public.concierge_link_master` |
| 回答ルール | `public.concierge_answer_rules` |

質問ログでは `source` を保存します。

| DB値 | 管理画面表示 | 用途 |
| --- | --- | --- |
| `rule` | 回答ルール | 登録済み回答ルールに一致 |
| `fallback` | 未整備候補 | 回答ルール未一致。本部確認・改善候補 |
| `manual` | 手動 | 管理者操作等 |
| `ai_adapter` | AI連携 | 将来のAI Provider連携 |

## リンクマスタ

フォーム・資料・アプリURLはSupabase `public.concierge_link_master` で管理します。

列は以下です。

| 列 | 内容 |
| --- | --- |
| `リンクID` | アプリ内部で使うID |
| `表示名` | 画面に表示する名前 |
| `URL` | Googleフォーム、Drive、社内アプリなどの実URL |
| `カテゴリ` | スタッフサポート、勤怠、教育など |
| `利用可否` | `有効` なら表示対象。`停止` / `無効` は除外 |
| `説明` | 運用メモ |

本部社員は `URL` を差し替えるだけで、NOV Naviの回答後リンクを変更できます。

リンクマスタは日常運用ではなく、フォームURL変更時に代表・管理者が触る想定です。

- `URL` 列を編集する
- `リンクID` は変更しない
- 使わないリンクは `利用可否` を `停止` にする
- 表示名を変える場合は、現場に見せて問題ない名称にする

初期リンクID:

```text
address-change
commuting-cost
hr-contact
celebration-condolence
family-name
paid-leave
attendance
timecard-fix
payroll
insurance
retirement-contact
evaluation
one-on-one
education
technical-manual
apps
```

## 回答ルールマスタ

NOV Naviの回答文はSupabase `public.concierge_answer_rules` で管理します。

列は以下です。

| 列 | 内容 |
| --- | --- |
| `ルールID` | ルールごとの一意ID |
| `キーワード` | カンマ区切り。どれかに一致したら回答対象 |
| `Notebookカテゴリ` | 表示する参照カテゴリ |
| `回答文` | NOV Naviが表示する本文 |
| `関連リンクID` | カンマ区切り。`concierge_link_master` のリンクIDを指定 |
| `利用可否` | `有効` なら利用。`停止` / `無効` は除外 |
| `優先度` | 数字が大きいほど先に判定 |

例:

```text
ルールID: moving
キーワード: 引っ越,住所,交通費,転居
Notebookカテゴリ: Notebook① スタッフサポート
回答文: 住所変更フォームを提出し、通勤経路が変わる場合は交通費変更フォームも提出してください。
関連リンクID: address-change,commuting-cost,hr-contact
利用可否: 有効
優先度: 100
```

本部担当者は管理画面から、コードやスプレッドシートを触らずに回答文や関連リンクを調整できます。

本部管理画面の「回答ルール管理」から、回答ルールを追加できます。担当者向けの基本ルールは以下です。

- `キーワード` はカンマ区切りで入力する
- `回答文` はスタッフにそのまま表示される文として書く
- `関連リンクID` は必要な場合だけ入力する
- 追加したルールは `concierge_answer_rules` に保存される
- 既存ルールの停止や細かな調整は、代表・管理者が裏側で対応する

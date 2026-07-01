# NOV HUB App Context v1

## 目的

NOV HUBからIDEA LINK、THANKS、タスク管理などの社内Webアプリへ、ログイン中社員の非秘匿Contextを渡すための共通仕様です。

このContextは、画面表示、初期値セット、メニュー出し分け、アプリ側ログイン判定の補助に使います。DB更新や重要処理では、必ずbackend、Edge Function、GAS、またはSupabase RLSで再検証してください。

## 正本

- 社員: Supabase Core DB `public.employees`
- 店舗: Supabase Core DB `public.stores`
- 権限: Supabase Core DB `public.roles` / `public.employee_roles`
- ログイン情報: NOV HUB backend側で検証

## 渡し方

NOV HUBはアプリ起動時、同一オリジンのアプリURLに `hub_context` を付与します。

```text
https://ideanow-shift.github.io/idea-nov-hub/idea-link/?hub_context=...
```

`hub_context` はJSONをBase64URL化した文字列です。PIN、PIN hash、Firebase ID token、Supabase service_role keyは含めません。

同時にNOV HUBは以下のキーでブラウザ保存も行います。

```text
novHub.currentEmployee
```

保存先:

- `sessionStorage`
- `localStorage`

有効期限:

- 12時間

## アプリ側の読み方

同じGitHub Pages配下のアプリでは、共通ライブラリを読み込んでください。

```html
<script type="module" src="https://ideanow-shift.github.io/idea-nov-hub/js/hub-context.js"></script>
```

```js
const context = window.NovHubContext.read();

if (!context || !context.id) {
  location.href = "https://ideanow-shift.github.io/idea-nov-hub/";
}
```

`read()` は以下の順でContextを探します。

1. URLパラメータ `hub_context`
2. `sessionStorage`
3. `localStorage`

URLから読めたContextは、次回以降のためにブラウザ保存されます。

## Context Shape

```js
{
  schema: "nov-hub-context",
  schemaVersion: 1,
  source: "supabase",
  sourceLabel: "Core DB",
  authType: "firebase",

  id: "employees.id",
  employeeId: "employees.id",
  coreEmployeeId: "employees.id",
  supabaseEmployeeId: "employees.id",
  staffId: "employees.id",
  employeeNumber: "1",
  firebaseUid: "Firebase Auth UID",

  name: "脇田 将樹",
  fullName: "脇田 将樹",
  displayName: "脇田 将樹",
  email: "m.wakita@idea-nov.com",
  authEmail: "m.wakita@idea-nov.com",

  corporation: { id: "uuid", code: "IDEA_NOV", name: "IDEA NOV" },
  corporationId: "uuid",
  corporationName: "IDEA NOV",

  department: { id: "uuid", code: "HQ", name: "本部" },
  departmentId: "uuid",
  departmentName: "本部",

  position: { id: "uuid", code: "", name: "社長" },
  positionId: "uuid",
  positionName: "社長",

  primaryStore: { id: "uuid", storeNo: "0000", storeId: "honbu", name: "本部" },
  primaryStoreId: "uuid",
  primaryStoreNo: "0000",
  primaryStoreCode: "honbu",
  primaryStoreName: "本部",
  storeId: "uuid",
  storeName: "本部",
  storeCode: "honbu",
  store: "本部",

  storeAssignments: [
    { storeId: "honbu", storeNo: "0000", storeCode: "honbu", storeName: "本部", assignmentType: "primary", priority: 1 }
  ],

  employmentStatus: "現職",
  employmentType: "正社員",
  isActive: true,

  roleLevel: 5,
  roleKeys: ["executive", "idea_link.admin"],
  roles: [
    { roleKey: "executive", roleName: "役員", scopeType: "all", scopeId: null },
    { roleKey: "idea_link.admin", roleName: "IDEA LINK 管理者", scopeType: "all", scopeId: null }
  ],
  permissions: {
    isSuperAdmin: false,
    isExecutive: true,
    isBackoffice: false,
    isAccounting: false,
    canViewAllMasters: true,
    canEditCoreMasters: false
  },
  tags: ["all", "executive"],

  storedAt: "2026-06-28T00:00:00.000Z",
  issuedAt: "2026-06-28T00:00:00.000Z",
  expiresAt: "2026-06-28T12:00:00.000Z"
}
```

## IDルール

- `id` / `employeeId` / `coreEmployeeId` / `supabaseEmployeeId` / `staffId` はすべて `public.employees.id`
- `employeeNumber` は人間が見る社員番号 `public.employees.employee_id`
- 新規アプリの外部キーは、氏名や社員番号ではなく `employees.id` を優先

## IDEA LINK権限

IDEA LINKは以下の `roleKeys` を見ること。

- `idea_link.staff`: 一般利用
- `idea_link.manager`: 管理・確認メニュー
- `idea_link.admin`: 全体管理・設定メニュー

いずれもない場合は、IDEA LINK側で利用不可にします。

```js
const roleKeys = new Set(context.roleKeys || []);
const canUseIdeaLink = ["idea_link.staff", "idea_link.manager", "idea_link.admin"]
  .some((roleKey) => roleKeys.has(roleKey));
```

## IDEA LINK本番運用

IDEA LINK連携は本番運用状態です。

- NOV HUB Contextログインを主経路にします。
- NOV HUBからIDEA LINKへは `/idea-link/` 経由で `hub_context` を渡します。
- IDEA LINK側はHub Contextの `employeeId` / `email` / `roleKeys` でログイン・権限判定を行います。
- IDEA LINK権限の正本はCore DBの `employee_roles` です。
- IDEA LINK利用者には `idea_link.staff` 以上を付与します。
- メール+PINログインは移行期間のfallback扱いです。
- スタッフ追加、メール変更、所属変更はNOV HUB/Core DB側を正本にします。
- 店舗別サンクス受付とLINE WORKS通知先はIDEA LINK管理画面で操作します。
- スプレッドシートは通常運用では操作しません。
- LINE WORKS通知はSupabase Queue + Edge Function経由で扱います。

## 禁止事項

- `service_role` keyをフロントへ出さない
- `pin_hash` をContextへ含めない
- Firebase ID tokenを子アプリのURLへ含めない
- `hub_context` だけをDB更新の認可根拠にしない
- 社員名やメールアドレスだけでユーザーを紐づけない

## 推奨ガード

```js
const context = window.NovHubContext.read();

if (!context || !context.id) {
  location.href = "https://ideanow-shift.github.io/idea-nov-hub/";
}

const actorId = context.supabaseEmployeeId || context.employeeId || context.id;
const actorEmail = context.authEmail || context.email;
const roleKeys = new Set(context.roleKeys || []);
```

## 重要

`hub_context` は便利な連携情報であり、最終的なセキュリティ境界ではありません。重要な書き込み、個人情報取得、管理者操作は必ずbackend側で `employees.id` と `employee_roles` を再確認してください。

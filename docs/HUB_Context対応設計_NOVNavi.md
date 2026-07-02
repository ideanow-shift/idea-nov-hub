# NOV Navi HUB Context対応設計

## 目的

NOV NaviをIDEA NOV HUB内の1機能として組み込む際、HUBにログイン済みの社員は店舗ID/PASSを再入力しない設計にする。

Phase1の店舗ID/PASSログインは暫定fallbackとして残し、最終的にはHUB個人認証、Firebase Auth、Core DB `public.employees.id` を正本にする。

## 現在の状態

現在のNOV Naviは、Supabase Edge Function `concierge-api` の `login` で店舗ID/PASSを認証し、署名付き `sessionToken` を受け取る。

```text
店舗ID/PASS
  -> concierge-api login
  -> concierge_store_credentials
  -> sessionToken
  -> NOV Navi API操作
```

この仕組みはPhase1の移行用として維持する。

## 最終形

HUBログイン済みの場合は、NOV NaviがHUB Contextを受け取り、社員・店舗・権限をCore DB IDで扱う。

```text
NOV HUB
  -> Firebase Auth
  -> employees.firebase_uid
  -> employees.id
  -> roles / employee_roles
  -> store assignments
  -> NOV Navi
```

スタッフには店舗ID/PASSログイン画面を見せず、HUBから自然にNOV Naviへ遷移させる。

## HUBから受け取るContext

HUB側はNOV Naviへ以下の情報を渡す。

```ts
type HubContext = {
  employeeId: string;          // public.employees.id
  firebaseUid?: string;        // public.employees.firebase_uid
  email?: string;
  displayName?: string;
  departmentId?: string;       // public.departments.id。必要時のみ参照
  positionId?: string;         // public.positions.id。必要時のみ参照
  jobTypeId?: string | null;   // employees.job_type_id。nullは未設定表示
  roleKeys: string[];          // roles / employee_roles由来
  storeAssignments: Array<{
    storeId: string;           // public.stores.id
    storeCode?: string;        // public.stores.store_id
    storeName?: string;        // 表示用。正本はCore DB
    isPrimary?: boolean;
  }>;
  activeStoreId?: string;
};
```

表示名、店舗名、部署名、役職名、職種名などは表示補助として受け取ってよいが、正本としてNOV Navi側へ重複保存しない。

職種が必要な画面や回答ルール分岐を作る場合は、`employees.job_type_id -> public.job_types.id` を参照する。`jobTypeId = null` の場合は `未設定` と表示する。

`レセプション` は役職ではなく `public.job_types` の職種として扱う。問い合わせルート、回答ルール、管理権限、HUB Context判定で `public.positions` の値として扱わない。`一般スタッフ` は `public.positions` の役職候補として扱えるが、管理権限ではなく、権限判定は必ず `roles / employee_roles` に寄せる。

`会長夫人` / `創業者夫人` / `夫人` のような家族関係・敬称ラベルは、役職・職種・雇用形態・権限として扱わない。HUB Context判定、管理画面権限、回答ルール、問い合わせルート、LINE WORKS通知先の分岐に使わない。

## 店舗Contextの決定

NOV Naviは以下の順で利用店舗を決める。

1. `activeStoreId` があり、`storeAssignments` に含まれる場合はそれを使う
2. `isPrimary = true` の店舗が1件ある場合はそれを使う
3. 所属店舗が1件だけなら自動選択する
4. 複数店舗がある場合はHUB側またはNOV Navi側で店舗選択を表示する
5. 本部権限で店舗所属がない場合は、本部店舗 `stores.store_id = honbu` を使う
6. 一般スタッフで店舗が解決できない場合は利用不可エラーにする

本部レコードはCore DBに存在確認済み。

```text
public.stores.store_id = honbu
public.stores.store_name = 本部
```

## 管理権限

管理画面は以下のいずれかのrole_keyを持つ社員だけに表示する。

```text
super_admin
admin
executive
backoffice
nov_navi.admin
```

必要に応じて `department_manager` を部門別管理に使う。ただし全体管理者とは分ける。

フロント表示だけで権限を完結させず、管理系APIでも必ず検証する。

## 保存時のマッピング

HUB Context利用時は、NOV Naviの保存データを以下へ寄せる。

| 用途 | 保存先 |
| --- | --- |
| 社員 | `employee_id = public.employees.id` |
| 店舗 | `store_id = public.stores.id` |
| Phase1ログインID | `phase1_login_id = null` |
| 権限判定 | `roles / employee_roles` |

Phase1店舗ID/PASS利用時のみ、従来通り `phase1_login_id` を保存する。

## API方針

短期では既存 `sessionToken` を維持する。

中期では `concierge-api` にHUB認証対応を追加する。

候補:

```text
loginWithHubContext
verifyHubSession
```

ただし、フロントが送るlocalStorage上のContextだけを信用しない。最終的にはFirebase ID tokenまたはHUB backendの検証済みsessionをEdge Function / backendで確認し、`employees.firebase_uid -> employees.id` を解決する。

## フロント実装方針

認証処理は以下のように分離する。

```text
HubContextAuthProvider
  HUBログイン済みContextを読む
  employeeId / roleKeys / storeAssignments を保持する
  管理画面表示可否を判定する

StoreAuthProvider
  Phase1店舗ID/PASS fallback
  concierge_store_credentials + sessionToken を使う
```

優先順位:

```text
HUB Contextあり
  -> HubContextAuthProvider

HUB Contextなし
  -> StoreAuthProvider
```

## localStorage方針

既存互換のため、当面 `novConcierge.*` keyは残してよい。

ただし、今後は画面表示名に合わせて内部名を段階移行する。

```text
現状: novConcierge.*
将来: novNavi.*
```

移行中は両方を読めるようにし、書き込みは新keyへ寄せる。

## 移行ステップ

1. 現行の店舗ID/PASSログインを維持する
2. HUBがNOV NaviへHUB Contextを渡す
3. NOV NaviがHUB Contextを検出した場合、店舗ID/PASS画面をスキップする
4. 管理画面表示を `roleKeys` で制御する
5. Edge Function / HUB backendでHUB認証を検証する
6. 質問ログ・問い合わせ・評価保存で `employee_id` を保存する
7. Phase1店舗ID/PASSをfallback扱いへ下げる
8. 全社員個人認証移行後、店舗ID/PASSログイン画面を通常導線から外す

## やらないこと

- NOV Navi側で社員マスタ、店舗マスタ、部署マスタを作らない
- NOV Navi側で職種、役職、雇用形態マスタを作らない
- 家族関係・敬称ラベルを社員属性、権限、通知先判定に使わない
- `レセプション` を役職として扱わない
- フロントのlocalStorage Contextだけで管理APIを許可しない
- `service_role` やFirebase秘密情報をフロントへ出さない
- 店舗ID/PASSを最終認証として固定しない
- `phase1_login_id` を個人識別の正本にしない
- HUB側のrolesとNOV Navi側の独自rolesを二重管理しない
- `positions` や `employment_type` を職種代わりに使わない
- `一般スタッフ` などの役職名を管理権限の代わりに使わない

## 確認項目

- HUBログイン済みで `/concierge/` を開くと店舗ID/PASSを求められない
- HUB Contextがない場合だけ `honbu / nov-admin` などのPhase1ログインが使える
- 一般スタッフには管理画面が表示されない
- 本部権限ユーザーには管理画面が表示される
- 質問ログ保存時に `employee_id` と `store_id` が入る
- Phase1 fallback時だけ `phase1_login_id` が入る
- 管理系APIはbackend側でも権限検証される

## HUB側へ伝えること

HUB側は、NOV Naviカード名を `NOV Navi` とし、遷移先は当面 `/concierge/` のままにする。

HUB Contextを渡せる段階になったら、上記 `HubContext` 形式に合わせて連携する。NOV Navi側はContextがある場合に店舗ID/PASSをスキップし、Contextがない場合だけPhase1ログインへfallbackする。

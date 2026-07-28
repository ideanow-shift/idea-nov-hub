# IDEA NOV OS アーキテクチャマップ

```mermaid
flowchart TB
  U["社員・経営者・管理者"] --> HUB["NOV HUB / NOV Navi"]
  HUB --> FA["Firebase Auth"]
  FA --> GW["Supabase Edge Functions / API Gateway"]
  HUB --> GW
  GW --> CM["Core Master: public employees / stores / corporations / roles"]
  GW --> PA["portal_apps / access_logs / notification inbox"]
  GW --> APPS

  subgraph APPS["業務アプリ群"]
    LINK["IDEA LINK / サンクスコイン"]
    TALENT["NOV Talent / 人財投資 / 現職者"]
    ATT["勤怠 / シフト"]
    MGMT["法人経営 / 店舗営業 / Management Platform"]
    FIN["Expense Hub / 経理サポート"]
    EDU["IDEA NOV EDU"]
    TASK["Task Manager / Decision Hub"]
    KNOW["NOV Navi Concierge / ナレッジ"]
    OTHER["Sales / EC / 1on1 / Instagram（実体要確認）"]
  end

  CM -. "重複候補" .-> CORE2["core schema employees/stores/corporations"]
  GW --> SB["Supabase DB / Storage / RPC"]
  GW --> LW["LINE WORKS"]
  OTHER -. "旧・暫定" .-> GAS["Google Apps Script / Sheets"]
  HUB --> DS["NOVA Design System"]
  APPS --> DS
  LINK -. "旧カード重複" .-> THANKS["THANKS / 旧理念浸透"]
```

## 境界原則

- 本人認証はFirebase Auth、認可はserver側のrole × scope × action、データ正本はSupabase Core。
- `public.employees/stores/corporations` が現行物理正本候補。`core`同名表は1件ずつで将来モデル候補。
- browserからservice roleを使わない。actor IDをrequest bodyだけで信用しない。
- NOV HUBのログイン後カード正本は `public.portal_apps`。`portal/apps.json` と `portal/js/apps.js` は表示・fallback資料。
- GAS/Sheetsは通常運用正本から退役方向だが、教育・旧THANKS・外部アプリに残存可能性がある。


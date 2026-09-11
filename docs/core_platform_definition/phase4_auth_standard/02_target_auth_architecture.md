# Target Authentication Architecture

```mermaid
flowchart LR
  U["社員"] --> H["NOV HUB"]
  H --> F["Firebase Auth"]
  F --> V["HUB verifier"]
  V --> X["One-time handoff"]
  X --> A["Application session"]
  A --> G["Common AuthN/AuthZ Gateway"]
  G --> I["Core actor resolution"]
  I --> P["role × scope × action × sensitivity × state"]
  P --> D["Supabase / RPC"]
  P --> L["Audit log"]
```

## Principal別

```mermaid
flowchart TB
  E["社員個人: Firebase UID"] --> EP["employee principal"]
  T["店舗共通端末: device credential"] --> TP["terminal principal"]
  HQ["本部管理者"] --> HP["employee principal + explicit admin permission"]
  FC["FCオーナー"] --> FP["employee principal + owned corporation/store scope"]
  S["通知worker"] --> SP["service principal + system_internal"]
  P["public/external user"] --> XP["external principal + isolated audience"]
  EP & TP & HP & FP & SP & XP --> GW["Gateway: default deny"]
```

- 店舗共通端末を社員個人として扱わない。端末操作で個人actionが必要なら、端末session内で短寿命のemployee step-upを行い両principalを監査する。
- platform_adminは業務PII閲覧を自動取得しない。
- public/external機能はemployee audienceとsessionを共有せず、公開resourceだけを許可する。
- server-to-serverは人間actionを代行せず、明示的 `system_execute` のみ許可する。

## Trust boundary

Browserはtoken保持・handoff開始まで。actor、role、scope、resource stateはserverが再取得する。DBは可能な限りactor/storeを再検証する。service roleは認証手段ではなく、認可後のDB credentialである。

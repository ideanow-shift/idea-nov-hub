# Core Master候補

基準日: 2026-07-28。根拠は `docs/supabase_audit` と `docs/rebuild_architecture` の読み取り専用監査である。件数は監査時推計で、ライブRLS/GRANTは未確定。

## 推奨

| 対象 | 論理正本 | 物理正本候補 | 判定 |
| --- | --- | --- | --- |
| スタッフ | Core Staff | `public.employees` | Proposed |
| 店舗 | Core Store | `public.stores` | Proposed |
| 法人 | Core Corporation | `public.corporations` | Proposed |

`public` は employees 775件、stores 22件、corporations 6件を持ち、既存HUB、Edge、経費、人財、勤怠から広く参照される。一方 `core` 同名表はいずれも1件で、列名・ID体系も異なる。このため、現時点では public を物理正本、core を未完成の将来モデル/互換候補とみなすのが最小リスクである。ただしADR-001の人間承認までは確定しない。

## 比較

| 観点 | public | core | 評価 |
| --- | --- | --- | --- |
| 主キー | UUID `id`。別に業務ID/codeあり | UUID `id`。codeあり | 相互ID対応は未確認 |
| 実データ | 775/22/6件 | 1/1/1件 | public優位 |
| 更新元 | HUB、人財/経費系RPC・管理画面候補 | migration/Edge候補 | single writer未確定 |
| 外部キー | 組織・所属へ多数 | 同schema内FK | publicの依存が大きい |
| 認証 | `firebase_uid`, `auth_email`, `email` | `firebase_uid`, `email` | 二重解決禁止 |
| role/scope | `employee_roles` 682件、店舗兼務473件 | `employee_roles` 1件 | public優位 |
| RLS | ライブ未確定 | ライブ未確定 | Gate必須 |

## データ品質と移行性

- UID、email、業務ID、UUIDの重複・欠損・一対多対応はライブSELECTで未確認。
- NULL、退職者、legacy行、無効店舗、孤立FKを先に計測する。
- 正本切替が必要でも、既存表の統合・削除はしない。ID mapping、read adapter、shadow read、照合、consumer単位切替を使う。
- 既存アプリは当面 public IDを受け取り続けられる。core IDを直接返す変更は破壊的である。

## 結論テンプレート

- 論理正本: Core Staff / Store / Corporation。
- 物理正本候補: public 3表。
- 理由: 実データ量、参照consumer、現行業務継続性。
- 影響: core直参照consumerはadapterへ寄せる。
- 移行: 必要。ただし参照統一のみ先行し、物理統合は別承認。
- 参照統一: `CoreReadAdapter` のversion付き契約で可能。
- 承認: CTO/Core DB ownerがADR-001を判断。

# Unknown and Missing Systems

## HUBに表示定義があるが実体不明

| app | known | missing |
| --- | --- | --- |
| 1on1 MTG | `portal/apps.json`, `portal/js/apps.js` | repo、URL、DB、owner、運用 |
| 営業部Web | static demo card | 実URL、source、sales DB |
| 営業部⇔教育部DB | static card | system boundary、schema、owner |
| キャンペーン管理 | static card | source、URL、運用 |
| 商品管理 | static card | EC repo、商品/在庫正本 |
| 棚卸し | static card | 商品管理との関係 |
| Instagram自動投稿 | static card | Meta app、token、approval |

## 最終確認が必要

1. `public.portal_apps` の現在値と実カード一覧。
2. GitHub orgの全repository一覧、private repo、archived repo、Pages/Actions。
3. 各本番URLの200応答だけでなく、owner同席の主要業務flow確認。
4. Supabase全schema/table/view/function/RLS/GRANT/Storage/Edge deploy一覧。
5. Firebase project、authorized domains、provider、UID重複。
6. GAS deployments、Apps Script project、Spreadsheet正本候補。
7. LINE WORKS/Meta/会計連携のSecret ownerとrotation。
8. system owner、data steward、SLA、利用者数、障害履歴。

アクセス不能な情報は推測で埋めず、個票でも「未確認」とした。


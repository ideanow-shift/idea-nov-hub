# Phase 5-3 NOV HUB Preview Integration 設計

## 遷移方式

同一タブ遷移を採用した。既存NOV HUBのカード操作、canonical sessionStorage、ブラウザBackをそのまま利用でき、iframeや新規shellを追加せず影響が最小である。URLは相対URL`./store-sales/`（画面URLは`/portal/store-sales/`）。

## Flow

```text
NOV HUB app card
  -> canonical NOV HUB session確認
  -> localhost Preview actor context保存
  -> same-tab Store Sales Preview
  -> canonical session + Preview context確認
  -> mock adapter
  -> synthetic Projection fixture
```

Store Sales側で独自ログインを作らない。Preview actor contextは本番認可ではなく、localhost mock専用の交換可能な入力境界である。production modeは引き続き起動拒否し、将来は同じadapter境界をserver-side actor-scoped Projectionへ置換する。

## Actor表示

- executive: 20店舗、Executive Summary、Priority Actions、Business Drivers、Store List
- department_manager: 担当6店舗のみ
- store_manager: 自店舗1店舗、「〇〇店の状況」、詳細4タブ
- franchise_owner: 自法人のFC5店舗のみ
- employee: Access Denied

fixture選択UIは設けない。URL queryによるrole/scope指定も使用しない。

## Icon

既存Design Systemの`assets/icons/sales.svg`を仮利用する。新規専用アイコン制作は別タスクとする。


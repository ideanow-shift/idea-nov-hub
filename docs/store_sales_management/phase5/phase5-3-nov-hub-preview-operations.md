# Phase 5-3 Preview 操作手順

## 確認方法

1. リポジトリrootをlocalhostの静的HTTP serverで公開する。
2. `/portal/?nov_navi_preview=1&demo=1&legacy=1`を開く。
3. 田中 本部、山田 部長、鈴木 店長、伊藤 FCオーナーのいずれかでデモ表示する。
4. 「店舗営業管理」カードを選ぶ。
5. Preview banner、actor別scope、HUBへ戻る、ブラウザBackを確認する。

Preview URLは`/portal/store-sales/`。直接URLはcanonical NOV HUB sessionとHUB発行Preview contextが揃わない場合に拒否される。

## 状態確認

既存mock fixtureでconfirmed、pending、preparing、validation_error、emptyを確認できる。employeeはAccess Denied、期限切れsessionはSession Expiredを表示する。

## 戻し方

Phase 5-3コミットをrevertする。production modeや本番接続設定は変更していないため、外部サービス側のrollbackはない。

## Screenshot

`docs/store_sales_management/phase5/preview/`に、HUB Desktop/Mobile、Store Sales Desktop/Mobile、Access Denied Mobile、Session Expired Mobileを保存する。


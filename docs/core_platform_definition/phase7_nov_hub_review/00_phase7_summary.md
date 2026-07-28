# Phase 7 Summary

## 総合判定

**Conditional Go**

Phase 6方式はNOV HUBへ最小変更で接続可能です。既存ログインとアプリカードを維持し、IDEA LINKで既に使われる短寿命one-time code発行・交換の境界を共通interfaceへ一般化し、アプリ単位feature flagを既定OFFにすれば、legacy起動へ即時rollbackできます。

ただしPhase 8で許可するのは、production依存のない実装、synthetic fixture、診断用canaryまでです。本番有効化、DB・権限・Secret変更、deployは別Gateです。

## 主要事実

- 本人認証はFirebase Googleログインとemail/PIN。
- NOV HUB sessionは15分のHS256 bearerで、`sessionStorage`からJavaScriptが読める。
- 一般アプリ起動は、employee、role、store等を含む署名なし`hub_context`をURLへ付与する。
- Management系ではFirebase ID tokenを`sessionStorage`および一時的に`localStorage`へ保存する。
- IDEA LINKだけは60秒のopaque code、DB条件付きconsume、アプリ専用sessionまで実装済み。
- backend actor解決はFirebase email RPCをUIDより先に試し、重複UIDを明示的にdenyしない。

## 最大リスク

ブラウザで読めるbearer tokenと、改ざん可能な`hub_context`が複数アプリ境界へ渡ることです。受信アプリがcontextを認可根拠にすると、XSS、URL履歴・referrer、storage改ざんによる成り済ましやscope逸脱につながります。

## 推奨canary

`hub-context-test`をsynthetic専用診断canaryにします。売上・人事・経営データを書かず、handoff、cookie、actor再解決、deny、audit、rollbackを検証できます。IDEA LINKは既存稼働経路のため最初のcanaryにはしません。

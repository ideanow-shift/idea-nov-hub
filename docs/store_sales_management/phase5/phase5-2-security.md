# Phase 5-2 Security

## Trust boundary

認可はProjection APIのserver-side actor contextで解決する。UIはrole、actor scope、legal entity、store access list、franchise company access listを送らない。Bearer session以外の資格情報、service role、tokenをURLやbodyへ含めない。

Integration adapterはGET、`Accept`、`Authorization`のみを使用し、`cache: no-store`、`credentials: omit`、timeout/abortを設定する。consoleへtoken、金額、raw responseを出力しない。DOMは`textContent`を基本とし、reason文字列をHTMLとして実行しない。

## Negative test

1. queryやload引数によるrole自己申告を送信しない
2. store ID差替えをdashboard要求へ混入させない（detail APIではserver再検証が必須）
3. franchiseの別`actor_scope_key`店舗混入を拒否
4. denied employee responseを拒否
5. non-local mockおよびproduction modeを拒否
6. service roleを送信しない
7. own_store複数店舗、department/franchise scope外店舗を拒否
8. malformed reasonを文字列として保持
9. キャッシュ無効
10. 401時にadapter clearとsession clearを実行
11. URLはendpointとperiodのみ
12. raw responseをログ出力しない

Phase 5-2ではキャッシュを使用しないためactor間共有は発生しない。将来有効化する場合はactor/session識別子、scope version、sales period、selected store、projection versionをkeyに含め、logout/session/scope変更時に破棄する。


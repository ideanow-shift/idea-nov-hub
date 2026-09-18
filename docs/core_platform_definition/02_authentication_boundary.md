# 認証境界

## 推奨フロー

1. NOV HUB/Firebase Authが本人を認証し、短寿命Firebase ID tokenを発行する。
2. 各WebアプリはBearer tokenを共通Gateway/Edgeへ送る。query parameter、恒久localStorage、店舗共通パスワードをセッション連携に使わない。
3. Gatewayが署名、issuer、audience、expiry、revocation相当を検証する。
4. 検証済み `sub`（Firebase UID）を物理正本のemployeeへ一意解決する。
5. employeeのactive/在籍状態、app role、scopeをserver側で解決する。
6. actionとdata scopeを認可し、その後だけDBへアクセスする。
7. actor employee ID、app ID、action、scope、result、correlation IDを監査する。

## 境界

| 境界 | 責任 |
| --- | --- |
| 本人確認 | Firebase Auth |
| 権限確認 | IDEA NOV OS共通Authorization service |
| データ範囲 | appのpolicy + Core ID scope |
| DBアクセス | RLSまたは認可済みserver endpoint |
| 監査 | 共通audit contract |

Firebase UIDを第一キーとし、email fallbackは移行期間中の明示許可・一意一致・監査付きに限定する。`public.employees` と `core.employees` を別々に検索して先に見つかったIDを採用してはならない。

## service role

- ブラウザ、静的配信物、ログ、URLへ露出しない。
- Edge内部でも認可を迂回する万能権限として扱わない。
- actorをrequest bodyの `employee_id` から信用せず、検証済みtokenから決定する。
- service role経由の処理も同じrole/scope/action判定と監査を通す。

## 現状の未確定点

- Firebase UID/emailの重複・欠損件数。
- NOV HUBと各アプリのhandoff/session実装差。
- ライブRLS、Policy、GRANT、SECURITY DEFINER、Storage policy。
- custom JWTの実利用範囲。
- 店舗ID/パスワード方式が残る機能と廃止計画。

最大リスクは、service roleを使うAPIでscope確認が欠落し、任意のemployee/store IDを指定できることである。次点はUID/emailの誤紐付けである。

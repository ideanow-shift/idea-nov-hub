# HUB Session Flow

1. 社員はNOV HUBで認証する。
2. HUBは既存canonical Sessionを同一originのStore Operationsへ引き継ぐ。
3. Runtimeはaudienceとexpiryを検証する。
4. AdapterはSession tokenをBearer headerへ設定する。
5. Store Sales APIがtokenを検証する。
6. Serverがemployee、Role、Permission、Store Scopeを解決する。
7. Serverがscope内Projectionだけを返す。
8. 401はSession破棄、403はForbiddenとして扱う。

TokenはURL、ログ、Projection、診断情報へ出さない。UIのRole controlsはPreview専用であり、Production authorizationには利用しない。

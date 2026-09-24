# Implementation Details

実装場所は`portal/canary/hub-context-test/`です。

- `CommonHandoffIssuer`: HUB sessionとsynthetic principalの一致を検査し、60秒opaque codeを発行。
- `InMemoryOneTimeCodeStore`: code hashだけをkeyにし、consume時に削除。
- `SyntheticActorResolver`: employee、terminal、serviceを分離し、unknown、duplicate、inactive、retired、login-disabledをdeny。
- `CanaryExchange`: app、audience、redirect、actor、CSRFを検査後、app sessionを発行。
- `AppSessionStore`: app binding、idle/absolute expiry、logout/revoke。
- `MemoryAuditSink`:許可されたsynthetic診断情報だけを記録し、失敗時はfail closed。
- `index.html`: allowlist済み診断fieldだけを`textContent`で表示し、queryを除去。

DBが必要な部分はmemory adapterです。production Edge endpointや既存IDEA LINK implementationには接続していません。

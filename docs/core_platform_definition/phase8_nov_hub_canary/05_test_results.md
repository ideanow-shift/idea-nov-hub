# Test Results

実行:

```text
node --test tests/nov-hub-handoff-canary.test.mjs
```

| 結果 | 件数 |
|---|---:|
| Total | 49 |
| Success | 49 |
| Failure | 0 |
| Skipped | 0 |

flag、allowlist、kill switch、発行、交換、replay、expiry、app/audience/redirect、actor mismatch、CSRF、全synthetic identity状態、terminal/service分離、Cookie contract、session expiry/revoke、audit、情報非露出、7 regression経路、canary非配線を検証しました。

未検証はtestのskipではなく環境Blockerとして別資料に記録しています。

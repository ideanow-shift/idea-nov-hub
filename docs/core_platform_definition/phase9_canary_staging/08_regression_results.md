# Regression Results

再実行:

```text
node --test staging/auth-foundation/phase6-staging.test.mjs tests/nov-hub-handoff-canary.test.mjs
```

| Total | Pass | Fail | Skip |
|---:|---:|---:|---:|
| 70 | 70 | 0 | 0 |

Google login、email/PIN、HUB session、card render、IDEA LINK、legacy `hub_context`、logoutのsource contractはPassです。canaryは現行mainへ未配線です。

role/store別card、mobile、PC、multiple tabの正式staging runtime回帰は未検証です。production code・環境は変更していません。

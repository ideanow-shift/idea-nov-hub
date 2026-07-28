# Regression Results

| 対象 | 結果 | 確認方法 |
|---|---|---|
| Google login | Pass | Firebase Google provider source contract |
| email/PIN login | Pass | current login handler source contract |
| HUB session generation | Pass | `issueHubSession`存在 |
| app card display | Pass | current render path存在 |
| IDEA LINK launch | Pass | existing handoff call存在 |
| legacy `hub_context` | Pass | current generation path存在 |
| logout | Pass | current logout path存在 |
| production非表示 | Pass | current `main.js`からcanary importなし |

既存ファイルの内容は変更していません。これはsource-level regressionであり、production runtime smoke testやdeploy後browser testではありません。

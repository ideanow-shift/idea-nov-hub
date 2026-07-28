# Cost Estimate

基準日: 2026-07-28。契約前に公式画面で再確認します。

## 無料候補

- Firebase Spark: no-cost plan。Google等の非phone Authは無料枠対象。[Firebase pricing](https://firebase.google.com/pricing)
- Firebase Hosting: 10 GB storage / 10 GB monthly transferまでno-costと公式documentationに記載。[Hosting quota](https://firebase.google.com/docs/hosting/usage-quotas-pricing)
- Supabase Free: 500 MB DB、5 GB egress、500,000 Edge invocations、最大2 active free projects。非稼働projectはpause対象。[Supabase pricing](https://supabase.com/pricing)
- GitHub Actions: public repositoryのstandard runnerとGitHub Pagesはfree。[GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)

## 月額候補

| 構成 | 目安 |
|---|---:|
| PoC、free枠に空きあり | 0 USD |
| Supabase Proで常時稼働 | 25 USDから |
| Supabase custom domain追加 | +10 USD/月 |
| Upstashを別storeとして採用 | Free、または10 USD固定 / 0.20 USD per 100K commands候補 |

案AはPostgresをone-time/auditにも使い、Upstashとcustom domainを初期導入しないため0〜25 USD/月を想定します。

## 従量課金risk / 制御

- Supabase overage、Edge invocation、egress。Proはspend cap既定ONを維持。
- Firebase Blazeへ上げる場合のHosting/Cloud利用。今回はSparkを第一候補。
- GitHub private plan/Actions超過はdashboardでUnknown。
- SMS/phone authは禁止。

削除するとSupabase projectの新規billingは停止しますが、当月利用分は残ります。Firebase/GCPはproject disable/delete、GitHub Secrets/environmentは削除します。budget alert、provider spend cap、test rate limitを設定します。

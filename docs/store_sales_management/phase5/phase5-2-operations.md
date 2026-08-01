# Phase 5-2 操作手順

## Mock

`portal/store-sales/adapter-runtime-config.js`のmodeを`mock`にした状態で、リポジトリのローカルHTTP serverから`portal/store-sales/`を開く。`?fixture=executive`等のfixture指定はlocalhostでだけ有効で、外部通信は発生しない。画面上部にMock bannerが出ることを確認する。

## Integration

1. 本番と分離されたsynthetic/staging Projection endpointを用意する。
2. runtime configのmodeを`integration`、`integrationEndpoint`を承認済みHTTPS URLへ設定する。
3. NOV HUB検証sessionを用いて開く。
4. Integration banner、actor scope、対象月、会計確定月、状態を確認する。

`production`は常にblocking errorとなる。query parameter、画面操作、localStorageではmodeを切り替えられない。

## Test

```powershell
node --test tests\store-sales-adapters.test.mjs tests\store-sales-ui.test.mjs
deno test tests\store-sales-projection.test.ts
python -m unittest discover -s tests\accounting_core
python -m unittest discover -s tests\accounting_kpi
deno check supabase\functions\nov-hub-api\store_sales_projection.ts
```

## Incident behavior

401はsessionとadapter状態を破棄して再ログインを案内する。timeout/500/409は安全な再試行案内、403はNOV HUBの権限確認、404は対象月/店舗確認、422/schema不正はデータ確認中として表示する。一般画面へSQL、内部ID、stack、raw responseを表示しない。

## Production前の人間確認

Projection owner、Accounting/KPI owner、Security、NOV HUB認証担当、店舗営業責任者が、契約version、scope、公開項目、会計確定期間、障害時表示、監査ログを承認するまで接続・deployしない。

# Read-only Runtime

Read-only保証:

- GETのみ
- request bodyなし
- UIからSupabaseへ直接接続しない
- service roleをブラウザへ渡さない
- INSERT / UPDATE / DELETE / UPSERT / write RPCなし
- cache: no-store
- response Contract validation
- timeout / abort / retry
- safe diagnostics（金額、token、個人情報なし）
- API失敗時Synthetic fallbackなし

このSprintはAdapter切替構造だけを完成し、Production endpoint、Secret、DB、RLS、migrationを変更しない。

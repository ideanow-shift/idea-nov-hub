# Distributed Store Results

## ローカル証跡

file lockを共有する複数process adapterで以下を再検証しました。

- SET-NX相当
- TTL
- destructive atomic consume
- 100並列交換: success 1、replay deny 99
- multi-process競合: success 1
- issuer/app binding
- expiry、revoke

## Gate

**正式staging: 未検証**

file storeは単一host上の検証であり、Redis、Upstash、staging Supabase、durable KVの分散保証ではありません。audience binding、cleanup job、network partition、multi-instance failoverを含む共有service検証が必要です。新規契約は行っていません。

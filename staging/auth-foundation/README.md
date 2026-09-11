# Staging Auth Foundation

外部staging資源を新規作成せず、ローカル複数プロセスでPhase 6を検証するproduction分離実装。

```powershell
node --test sandbox/auth-foundation/auth-foundation.test.mjs staging/auth-foundation/phase6-staging.test.mjs
node staging/auth-foundation/browser-session-server.mjs
```

鍵はprocess内で毎回生成し、ファイルへexportしない。one-time storeとauditのテストデータはOS一時ディレクトリだけへ作成し、テスト終了時に削除する。

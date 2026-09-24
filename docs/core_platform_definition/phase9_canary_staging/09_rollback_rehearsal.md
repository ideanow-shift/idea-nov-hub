# Rollback Rehearsal

## Local contract

- kill switch優先停止: Pass
- global/app/environment OFF: Pass
- allowlist deny: Pass
- fallback audit: Pass
- app session revoke/logout: Pass
- legacy source非影響: Pass

## 正式staging

**未実施**

実rehearsalでは、kill switch反映時間を計測し、全issuer instance停止、未交換code revoke、app session revoke、canary route非表示、legacy経路無影響、audit完結を確認します。Ownerとstaging runtimeが未確定のため実行していません。

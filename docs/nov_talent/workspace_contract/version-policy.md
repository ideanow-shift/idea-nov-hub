# Workspace Contract Version Policy

- 現行Version: `1.0.0`
- 正本: `contracts/nov-talent/workspace/v1.schema.json`
- Edge、Frontend runtime config、Pages metadataは同一Versionを宣言する。
- 不一致時はRelease GateをFAILとし、公開しない。
- additiveなfield追加でもexact-key契約では互換性に影響するため、Version変更と段階公開を必須とする。
- 移行期間の`legacy-v0-read`は、version fieldが存在しない旧Workspaceレスポンスだけをv1へ正規化する。unknown keyや型不一致は許可しない。
- Edge v1の稼働確認後に互換モードを停止し、旧Version削除を別Release Gateで行う。

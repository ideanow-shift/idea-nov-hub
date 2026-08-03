# NOV Talent Platform Environment Policy

## 正式環境

- Production Project: `idea-nov-core`
- Staging Project: `idea-nov-staging`

IDEA NOV PlatformはProduction Project 1つ、Staging Project 1つを共通利用する。NOV Talent専用または機能別の追加Supabase Projectは作成しない。

## NOV Talentの分離境界

共通Staging内で、NOV Talentは次の単位を他システムから分離する。

- schema
- Edge Function namespace
- Storage namespace
- Versioned Dataset
- Migration owner
- Permission boundary

現在のCandidate運用では、Versioned Dataset、`nov-talent-staging-readonly-api`、RLS、既存HUB Role GuardをNOV Talentの境界とする。

## 禁止事項

- 新規Sandbox Projectの作成
- 旧Staging名称の利用
- Project増設を前提とした設計
- `idea-nov-core`への未承認Migration・書込み・昇格
- Stagingのservice roleまたはDB credentialのブラウザ公開

## 変更境界

この方針文書は環境名と運用境界を固定するものであり、Production、Stagingのschema、Database、Auth、RLS、Function、Storage、Datasetを変更しない。

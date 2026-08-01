# ADR-007: Core Master Migration Policy

## Status

Proposed。

## Decision

Store Master変更は通常の機能開発から分離し、ADR、証跡、複数owner承認、rehearsal、rollbackを必須とする。Productionの手編集を禁止する。

## Prohibitions

- Production Console/SQL Editorによるad hoc INSERT、UPDATE、DELETE
- UUIDの再生成、上書き、再利用
- store code/nameだけによる自動merge
- destructive rename/dropとconsumer切替の同時実施
- rollback不能なone-way migration
- backup、件数、FK、RLS、contract検証なしのdeploy
- seedやfixtureからProduction Masterを生成
- migration内で未承認の業務判断を行うこと
- Accounting confirmed factのsilent remap

## Approval flow

1. ADRまたはADR amendmentで目的、影響、選択肢を承認する。
2. Core Master Ownerがidentity・UUID・source evidenceを確認する。
3. Sales Ownerが店舗identity、Direct/FC、運営期間を確認する。
4. Accounting Ownerが確定済み期間・mapping・lineage影響を確認する。
5. Security OwnerがRLS、grant、audit、separation of dutiesを確認する。
6. Platform Ownerがcontract、performance、backup、rollbackを確認する。
7. Entity Approval Boardが差分を承認する。
8. CTOがProduction execution gateを承認する。

同一人物による作成・承認・Production実行の完結を禁止する。

## Migration lifecycle

```text
proposed
  -> approved
  -> rehearsed
  -> scheduled
  -> executing
  -> verified
  -> completed
             \-> rolled_back
```

推奨手順はexpand → dual-read verification（dual-writeではない）→ controlled backfill → consumer switch → observation → contract。旧contractは観測期間中read-onlyで保持する。

## Versioning

- schema migration、Core Master Access Contract、mapping dataset、RLS policyを個別version化する。
- migration IDは一意・順序付きで、checksumとGit commitを記録する。
- breaking contractはmajor version、新しいoptional fieldはminor、意味を変えない修正はpatch。
- data correctionは新version・supersedeとして記録し、履歴を消さない。
- Accounting mapping versionとeffective periodを記録し、再現性を保つ。

## Rollback

実行前にrollback trigger、owner、許容停止時間、backup/restore point、旧contractへの戻し方を文書化する。rollbackはUUIDや履歴を削除せず、consumerを旧versionへ戻すか新しい補正versionを追加する。不可逆操作はcopy/verify後の別change windowまで延期する。

## Verification gates

- 承認済20店舗とのmissing/extra diff
- UUID・store code・source keyのunique/FK整合
- effective periodのgap/overlap
- 所沢crosswalkと全consumer FK
- RLS role matrixのpositive/negative test
- Accounting Core/Store Sales contract回帰
- audit log、performance、backup restore rehearsal
- `git diff --check`とmigration checksum

本Sprintではmigrationを作成・実行しない。

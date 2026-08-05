# NOV Talent private read-only Migration dry-run

## 判定

`PASS_PRIVATE_READ_ONLY_DRY_RUN`

2026-08-03にData Dictionary Version 1.2.0の正式Source 2件をread-onlyで読み、個人値を永続化せずメモリ内だけで正規化・同一性判定・移行先振分を行った。旧コピー、DB、staging、Production、service roleは使用していない。

## Source Snapshot

| Source | Source行 | Migration対象 | テンプレート除外 | Source SHA-256 |
|---|---:|---:|---:|---|
| `OFFICIAL_SOURCE_27_CONTACTS` | 541 | 528 | 13 | `361f5f4822a0215e580347462ba37d5a7fed405053276cdd6f1a4cf78487fd88` |
| `OFFICIAL_SOURCE_28_CONTACTS` | 526 | 108 | 418 | `63b265848527b28e53b5fe220eff4e127e13802a1eccd637a6c65cfa0a259430` |
| 合計 | 1,067 | 636 | 431 | - |

## Migration候補件数

| 区分 | 件数 |
|---|---:|
| Candidate候補 | 636 |
| 新規Candidate候補 | 636 |
| 同一Candidateへ集約した行 | 0 |
| Event / Contact候補 | 1,550 |
| Selection History候補 | 0 |
| Quarantine | 0 |
| `exact_match` | 0 |
| `probable_match` | 0 |
| `ambiguous` | 0 |
| `conflict` | 0 |
| `no_match` | 636 |

正式な接触Sourceには契約上の強いキーとして使える電話、email、LINE識別子、外部IDが存在しないため、氏名だけ、または氏名・学校・卒年の補助一致から自動集約していない。最低条件である氏名と学校を満たす各行を新規Candidate候補として分離した。これはDB書込みやCandidate作成ではない。

Event / Contact件数は、正式Sourceの接触日、LINE接触、見学、動画配信、TO DO等の認識済み列について、移行可能Candidate行の非空セルを1履歴候補として集計した。Selection History対象列は両Sourceで非空値が0件だった。

## Human Review

人間確認済み17件の証拠Hashを固定し、重複候補6グループはすべて `different_person / keep_separate` として適用した。現行Sourceに存在する行は別Candidate候補として維持し、欠番となった過去行は復元していない。自動統合・自動削除は0件、pending reviewと当該グループ由来Quarantineは0件である。

## Sealed Snapshot候補

- Snapshot: `migration-dry-run-snapshot.candidate.json`
- Snapshot ID: `NOV-TALENT-DRYRUN-20260803-361F5F48-63B26584`
- Artifact SHA-256: `7ea70656b76aad4bebb01fbeae0afbf26fc4e47fe0fd37039a4af89f894e74ba`
- Validation: `PASS`
- Quarantine: 0件
- Owner approval: 未承認
- Migration approval: 未承認

個人値を含む正規化行はメモリ内でのみ処理し、GitHub、Markdown、Console、ログ、local artifactへ永続化していない。公開成果物は件数、Hash、契約、Source識別子だけを保持する。

## Gate

private read-only dry-runと歴史Snapshot候補生成は完了した。2026-08-03にVersion 1.3.0で正式Sourceをread-only再受領し、`staging-migration-snapshot.candidate.json` を生成した。Owner受領・Staging承認後の実行前確認で受入schema不整合を検出したため、書込み0件で安全停止した。Production Migrationは別昇格承認まで禁止である。

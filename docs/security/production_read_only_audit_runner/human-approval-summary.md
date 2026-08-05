# Human Approval Summary

## 推奨初期値

| 項目 | 推奨初期値 | 根拠 |
| --- | --- | --- |
| 最大Query数 | 12 | 目的を限定し、調査の膨張を防ぐ |
| 1 Query最大行数 | 1,000 | catalog/metadataの上限として十分で、exportにならない |
| statement timeout | 5秒 | 本番への待ち時間を短く保つ |
| lock timeout | 1秒 | ロック待ちを回避する |
| idle transaction timeout | 10秒 | 開きっぱなしのread-only transactionを防ぐ |
| 全体実行時間 | 60秒 | 監督できる単発実行に限定する |
| 同時接続数 | 1 | 監査Roleの同時利用を排除する |
| 資格情報有効期間 | 最大24時間 | 単発監査の後に残さない |
| 証跡保存期間 | 365日 | 年次監査と説明責任のため |
| 実行回数 | 承認run IDにつき1回 | 無制限の再試行を防ぐ |
| 失敗時 | 原因レビュー後の再承認 | timeoutや不一致を無視しない |

## 高リスク項目

1. D01: 誤環境へ接続するリスク。profile全一致以外は許可しない。
2. D02: 監査Roleの過剰権限。service role・BYPASSRLS・継承・関数実行を認めない。
3. D03/D05: 固定Queryや出力allowlistの逸脱。任意SQLとraw結果を認めない。
4. D08/D10: 役割分離と資格情報失効。起動者がcredentialを保持しない。

## 承認後の操作

- **人間**: 三者承認、private identity profile確認、DBAによる未適用Role案の別ゲート審査、実行枠と保管先の確定。
- **Codex/OS**: 承認済みmanifestの整合確認、sealed packageのhash検証、承認された単発read-only runnerを起動し、sanitized receiptを作成する。Role作成、接続、Query実行はそれぞれ別の明示ゲートが必要。

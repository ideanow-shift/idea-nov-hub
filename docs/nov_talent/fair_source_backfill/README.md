# NOV Talent Fair Source Backfill

## 判定

`BLOCKED`。37件先行反映の承認後に正本をread-onlyで再監査しました。名称・開催日が揃う37件のうち1件が数値形式の要確認行です。「要確認3件をStagingへ反映しない」という条件を適用すると安全反映可能数は36件となり、承認件数37件と一致しません。件数不一致時rollback条件に従い、Staging書込み前に停止しています。

## 正式Source

- Spreadsheet: `求人計画27卒_2025年9月～2026年8月`
- Sheet: `ガイダンス/フェア結果`
- Spreadsheet ID: `1nwlOIdQMmPq4ogXOTf-oinAQKnwSTlb3X7Dw8kWowCM`
- Sheet ID: `938747439`
- Snapshot range: `A2:R50`
- Access: read-only
- Source hash: `045991d466c3f8f6c9e27a34526f7f697bca60bc8e259d72e097bb0c297975c0`

個人名、連絡先、参加担当者、備考の実値はGitHub差分・ログへ記録していません。

## 最新dry-run

| 項目 | 件数 |
|---|---:|
| 観測したSource行（3〜50行） | 48 |
| 旧dry-runが業務行として数えた行 | 44 |
| 名称・開催日が揃う実フェア | 37 |
| 名称・開催日不足 | 2 |
| No.だけの未使用テンプレート行 | 5 |
| 完全空テンプレート行 | 4 |
| 数値形式の要確認行 | 1 |
| 既存Fairとの完全一致 | 0 |
| 要確認3件をすべて除外後に追加可能 | 36 |

旧44件は、名称・開催日がないNo.だけのテンプレート行5件と、識別項目不足2件を含んでいました。現在の正本値を根拠に44件を作ることはできず、名称や日付の推測補完も行いません。

## 最新Schemaへの対応

Schema Completionにより、費用・各件数は `NULL=未登録` と `0=正式な0` を区別できます。運営会社、形式、接触見込み、全体入場数、参加サロン数も正式列へ保存できます。

参加担当者はSourceに同名列が2つあるため自動選択しません。備考は個人値を含む可能性があるため自動移送しません。面接・内定・採用は安全にFair IDへ紐付いたSelection Historyのみから集計します。

## 37件先行反映manifest

`fair-backfill-manifest.json` にSnapshot、Source Hash、Schema Version、期待件数、除外条件、transaction条件を固定しました。preflightは `BLOCKED_BEFORE_WRITE` です。

## 再開条件

次のいずれかを総務人事部が確定した後、新しい明示件数でSnapshotを再生成します。

1. 数値形式要確認1件を、数値をNULLのまま含める37件目として明示承認する。
2. または、要確認3件を全除外した36件反映へ件数を変更する。
3. または、正本の要確認セルを修正後に再監査する。

No.だけの未使用テンプレート行5件は反映対象外です。確認対象は `human-review-list.md` に個人情報を含めず記録しています。

## 安全確認

- Spreadsheet書込み: 0件
- Staging書込み: 0件
- Production書込み: 0件
- 既存Fair更新: 0件
- 自動統合・自動削除: 0件

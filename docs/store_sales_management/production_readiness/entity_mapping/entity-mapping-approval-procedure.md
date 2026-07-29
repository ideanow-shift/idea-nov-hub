# Entity Mapping承認手順

1. Accounting ownerがsource entity名・年度出現・会計node種別を確認する。
2. Core Master ownerが既存UUID、entity type、状態、valid periodを確認する。UUID新規推測は禁止。
3. Sales ownerがstore名、Direct/FC、移管日、閉店状態を確認する。
4. Management approverが法人・Business Portfolio・部門帰属を確認する。
5. 4承認列を個別に更新し、全必須承認がapprovedになった場合のみfinal_statusをapprovedへ変更する。
6. rejectedは理由をnotesに残す。履歴行の削除・上書きは禁止。
7. blockedは質問と証跡を追加して再審査する。自動統合しない。

## 一括承認条件

high / proposed 15件は「候補identity」の一括確認対象。Core UUIDや期間の自動承認ではない。CSV/JSONを編集する際は列・allowed value・38行を維持する。

## Gate

38/38の必要承認、UUID、期間矛盾、重複解消が完了するまで、実データ接続、migration、deployを禁止する。

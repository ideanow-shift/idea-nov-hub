# Master Verification Summary

## 判定

BLOCKED。Googleと承認Boardは現行20店舗で対応するが、Core実値がないため三者照合を確定できない。

|match_status|件数|
|---|---:|
|exact_match|0|
|normalized_match|0|
|approved_override|0|
|history_required|0|
|missing_in_core|0|
|missing_in_google|0|
|duplicate_candidate|0|
|conflict|0|
|unknown|20|
|合計|20|

`missing_in_core=0`はCoreに存在するという意味ではない。実DBまたは正式exportを確認できないため、不存在判定を避けてunknownとした。

## Quality Gate

|項目|件数|
|---|---:|
|Blocking|20|
|Core UUID確認済み|0|
|Core店舗コード確認済み|0|
|open_date三者一致|0|
|effective period三者確認済み|0|
|Google↔Board現行店舗候補対応|20|
|Google運営履歴あり|20|

## 補助所見

- Direct 13 / FC 7はGoogle現行運営会社とBoardで整合。
- 立川店はGoogleログ上、BIOELが2026-05-31終了、IDEA NOVが2026-06-01開始。
- FC化履歴: 新所沢、久米川、国分寺、花小金井、東久留米。
- 直営化履歴: 立川、野方。
- Googleには撤退済み`KYARA1/2高田馬場`が別行で存在し、KYARA HALF店へ統合しない。
- Googleの本部行は店舗20件の集計外。

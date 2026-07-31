# Entity Mapping不一致・重複

## 重複候補（6組）

|BASSA source|FC source|論点|
|---|---|---|
|BASSA新所沢店|FC新所沢|現行FC帰属、切替日、旧direct entityの扱い|
|BASSA久米川店|FC久米川|同上|
|BASSA国分寺店|FC国分寺|同上|
|BASSA花小金井店|FC花小金井|同上|
|BASSA東久留米店|FC東久留米|第12期出現日と移管日|
|BASSA立川店|FC立川|FCは第12期、BASSAは第13期から出現し期間関係が逆転候補|

## 表記揺れ

- BASSAアネックス店 ↔ ANNEX店
- FCロアネ ↔ Roane店
- BASSA*店 / FC* / 接頭辞なし店舗名
- 全体(合計) / 全体(共通)、FC(合計) / FC(共通)は別の会計nodeであり統合禁止

## その他のBlocking

- 正式legal entity名・UUIDが未確認。
- 本部はCoreの単一entityへ割当禁止候補。
- 教育部再編前後のsuccessorが未承認。
- FC法人5候補と各店舗の対応証跡がない。
- 閉店・suspendedを示す正式master証跡は確認できず、勝手に状態変更しない。

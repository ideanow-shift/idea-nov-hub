# 既存UI

## 画面一覧

| 画面/要素 | 現状 | 対象利用者 | 判定 |
|---|---|---|---|
| 法人経営管理 overview | 法人KPI・P/L表示骨格 | 経営者/営業部 | Reuse |
| four-axis | 収益性等の比較表示 | 経営者 | Reuse |
| departments | 部門比較 | 経営者/営業部 | Extend |
| 店舗別状況 | 店舗、法人、スタッフ、売上、達成率、状態 | 店長/営業部 | Extend |
| dataops | データ準備状態 | 管理者 | Reuse |
| CSV要件/取込補助 | local-only validation | データ担当 | Reuse |
| コメント/改善導線 | 一部表示構造あり | 店長/営業部 | Extend |

## 完成していない点

- 今日の売上や日次推移は確認できない。
- 店舗APIの売上・客数・生産性はplaceholderで、実績表示とはいえない。
- スタッフ別実績のcanonicalな表示経路はない。
- 店長向け「次にやるべきこと」のworkflowは未完成。
- エリアマネージャー専用の比較、遅延店、指示画面は確認できない。
- 営業部向けランキング、異常値、会議資料出力は未完成。
- 経営者向け店舗収益性と店舗売上原本の照合は未完成。
- 入力はlocal previewで、本番保存・承認・再計算が無効。

## モバイル

CSSに768pxと480pxのbreakpoint、grid縮退、table overflowがあり、responsive対応の土台はある。実機でのタップ領域、横スクロール、長表、複数タブの確認は未実施なので、スマホ対応は「source-level確認済み、実用性はUnknown」とする。

## 再開方針

新画面を別に作らず、既存の店舗別状況をMVPの表示shellとしてExtendする。最初にmock/placeholderを明示し、正式契約に適合したread modelができるまで実績として表示しない。

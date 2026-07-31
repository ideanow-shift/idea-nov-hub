# Store Operations Management V1 Sprint 1 Final Summary

## 判定

社内UXレビュー開始用のMock Previewを完成した。対象は全店の状況、優先して確認すること、業績を動かした要因、店舗一覧、店舗詳細4タブ、Role/Runtime切替、レスポンシブ表示である。

## レビュー対象

- 代表または副社長: 全20店舗の状況と判断材料
- 営業部長: 直営13店舗、要対応店舗、優先アクション、店舗比較
- エリアマネージャー: 担当5店舗と要対応店舗
- 店長: 自店舗詳細、今月の重点、4タブ

## 境界

全数値は画面確認用の合成Mock値であり、実績値ではない。実売上・実利益・実KPI・実会計データ、Supabase、API、JWT、RLS、Core DB、Production、Stagingには接続しない。

Preview/Mockだけで明示的Mock Identityを使用する。Production、Staging、Integration、Feature Flag未指定では認証バイパスを拒否する。

## 最終UI調整

- 英語の重複補助見出しを日本語へ整理
- 総売上に対象月または累計基準月を明記
- Previewへサンプルデータ注意書きを表示
- Mock ControlsをPreview/Mockだけに限定
- 正式20店舗名を再確認

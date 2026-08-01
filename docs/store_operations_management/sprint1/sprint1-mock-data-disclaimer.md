# Sprint 1 Mock Data Disclaimer

このPreviewはStore Operations Management V1の画面構成・判断導線・操作性を確認するための社内レビュー用環境である。

## 使用するデータ

- 画面確認用に生成した合成Mock値
- 実UUIDと区別した`mock-store-*`識別子
- 正式な店舗表示名20件
- Preview/Mock限定の明示的Mock Identity

## 使用しないデータ・接続

- 実売上、実利益、実KPI、実会計データ
- Supabase、Core DB、Production、Staging
- 売上API、利益API、Projection実API
- Production JWT、RLS、HUB認証バイパス

画面に表示される金額、比率、客数、スタッフ数、状態、改善テーマは実績値ではなく、評価・意思決定・人事判断には使用できない。

Production、Staging、Integration、Feature Flag未指定ではMock Identityを利用できず、従来のHUB認証要求を維持する。

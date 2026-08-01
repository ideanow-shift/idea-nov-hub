# Sprint 1 再利用インベントリ

## 再利用したもの

- `portal/talent/index.html`: 公開済みの画面構造、分析タブ、CSV確認UI
- `portal/talent/style.css`: IDEA NOVの配色、カード、レスポンシブ規則
- `portal/talent/app.mjs`: タブ、フィルタ、ソート、候補者詳細の描画
- `portal/talent/analytics.mjs`: フェア・学校・採用状況の集計
- `portal/talent/csv-import-preflight.mjs`: 28卒CSVのローカル形式検証
- 既存テスト: UI階層、分析、CSV、候補者プロフィール、現職者モジュールの回帰

## 新規の最小部品

- `mock-seeds.mjs`: 匿名seed生成
- `mock-repository.mjs`: 読み取り専用のMock Repository
- `runtime.mjs`: UIとMock Repositoryの実行境界

既存機能を置換せず、公開UIへ最小のRuntime境界を差し込んだ。CSV、DBスキーマ、API Contractは変更していない。

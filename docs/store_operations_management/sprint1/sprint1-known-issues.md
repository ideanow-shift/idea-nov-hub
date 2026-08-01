# Sprint 1 Known Issues

- Mock Runtimeレビュー用のため、売上/利益API、Supabase、JWT、RLSとは未接続。
- 月次/累計切替はSprint 1のUIレビュー用状態であり、表示期間は切り替わるがMock値の再集計は未実装。
- ブラウザ再読み込み後のUI状態永続化は対象外。詳細から一覧へ戻る同一セッション内の状態は保持する。
- 確認用コントロールはPreview/Mock Feature Flagだけで表示する。Production、Staging、Integration、Feature Flag未指定では非表示。
- ツールチップは使用せず、FTE換算説明は常時読める補足文として提供している。
- 通常Chromeウィンドウの自動操作はWindows側の現在URLを安全に確定できず実行不能だった。独立したローカルChrome headlessではConsoleエラー0件と5秒以内のMock描画を確認済み。人間向け通常Chromeレビュー手順も提供する。
- リポジトリ全Node回帰にはSprint外の既知失敗が15件ある。変更前後とも15件で、新規失敗は0件。

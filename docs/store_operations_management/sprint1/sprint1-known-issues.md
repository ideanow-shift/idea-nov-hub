# Sprint 1 Known Issues

- Mock Runtimeレビュー用のため、売上/利益API、Supabase、JWT、RLSとは未接続。
- 月次/累計切替はSprint 1のUIレビュー用状態であり、Mock値の再集計は未実装。
- ブラウザ再読み込み後のUI状態永続化は対象外。詳細から一覧へ戻る同一セッション内の状態は保持する。
- 開発用Mock controlsはレビューartifactに表示される。Production feature flagでは既存policyにより起動拒否される。
- ツールチップは使用せず、FTE換算説明は常時読める補足文として提供している。
- Codex内ブラウザのlocalhost隔離ポリシーにより自動実ブラウザ到達確認は実施できなかった。ローカルサーバー起動と94件のUI/Runtime契約テストで検証し、指定viewportの目視確認はレビュー手順に残す。

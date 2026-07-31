# Sprint 1 テスト報告

## 自動テスト

対象はUI階層、承認境界、採用分析、CSV preflight、候補者プロフィール、staging補足、凍結した現職者モジュール、Sprint 1 Mock Runtimeである。

確認事項:

- JavaScript構文
- 27卒27件・28卒120件・合計147件
- 今日やることが最大5件
- 全9状態
- Supabase URL・ネットワーク・書込み設定なし
- NOV Peopleの公開ナビゲーションなし
- PC・スマホの主要導線

## 最終結果

- 自動テスト: 101/101 PASS
- JavaScript構文: PASS
- `git diff --check`: PASS
- PC実ブラウザ: 候補者147件、今日やること5件、履歴3区分、NOV Peopleタブ0件
- スマホ実ブラウザ（390×844指定、実表示幅375px）: 横スクロールなし、候補者147件、今日やること5件
- 通信・DB・書込み: 0

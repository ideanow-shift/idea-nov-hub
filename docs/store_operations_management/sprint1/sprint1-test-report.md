# Sprint 1 Test Report

基準実行: Store Sales既存回帰 84/84 PASS。

最終化後:
- Sprint 1 / Store Sales回帰: 108/108 PASS
- Node構文検証（app / Runtime / Mock Identity）: PASS
- ローカルChrome headless（5秒budget）: Exit 0
- Chrome Console `SyntaxError` / `Uncaught`: 0件
- Chrome DOM: 全店の状況、総売上、優先事項、業績要因、店舗一覧、サンプル注意書き、Mock金額を確認
- Loading終了: 確認
- Preview用確認コントロール表示: 確認
- `git diff --check`: PASS

リポジトリ全Node回帰:
- 変更後: 427件中412 PASS / 15 FAIL
- 変更前commit `c39f26e`: 423件中408 PASS / 15 FAIL
- 新規失敗: 0
- 15件はSprint外の既知失敗（GAS廃止資料の欠落、Management/Talent固定契約差異）

新規失敗数: 0。

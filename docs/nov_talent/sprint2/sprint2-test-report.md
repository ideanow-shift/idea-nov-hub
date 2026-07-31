# Sprint 2 Test Report

## 自動テスト

- 対象: NOV Talent UI、候補者、CSV preflight、分析、プロフィール、補足、承認境界、Sprint 2 Recruitment UX
- 合計: 128件
- 期待結果: 128 PASS / 0 FAIL

## Sprint 2追加確認

- 6つの採用指標
- 結論の優先順位
- 今日やること最大5件
- AI・推測値の不使用
- Event ROIの費用未登録表示
- 候補者履歴3区分
- Mock Runtime 9状態
- Dashboard表示順
- モバイル横スクロール禁止
- Supabase import不在

## ブラウザ確認

- PC: 結論 → 6指標 → 最大5タスクの順序
- モバイル 390px: document幅とviewport幅が一致
- Candidate List: 検索・絞り込み・並び替えと147件の匿名候補者を表示
- Candidate Detail: 今日の対応、完了チェック、3区分の履歴を表示
- Event: 既存データ由来の3到達率を表示し、金額ROIを推測しない

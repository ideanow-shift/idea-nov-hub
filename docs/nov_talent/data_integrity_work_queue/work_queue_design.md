# Work Queue Design

## 目的

総務人事部が毎日、今日修正する対象だけを上から確認する。正本は総務人事部管理のSpreadsheetとし、Work Queueは修正対象管理だけを担う。分析、CSV、Migration、学校分析、イベント分析は表示しない。

## 画面構造

1. 今日修正する件数
2. KPI 4項目: Work Queue解消率、Data Consistency整合率、修正済件数、残件数
3. 不足・重複カテゴリ件数
4. Data Consistency Issue（Work Queueとは別管理）
5. 現在修正する1件
6. 今日残っている対象

## 今日のQueue

- 氏名不足: 4件
- 状態不足: 2件
- 重複候補: 6組

本日の確定対象は12件。解消済み5件は正式Queueから除外する。

## Data Consistency Issue

- 27卒 接触データ: 採番済547行 / 実データ入力済535行 / 差分12件
- Work Queueへ混在させず、Data Consistency整合率は正式な件数定義が確定するまで未算出
- Migration判定は保留

## 境界

Work QueueからDB、Production、Candidate Repository、ローカルファイルへの保存は行わない。表示する修正候補は確認用であり、実際の修正は正本Spreadsheet上で総務人事部が行う。

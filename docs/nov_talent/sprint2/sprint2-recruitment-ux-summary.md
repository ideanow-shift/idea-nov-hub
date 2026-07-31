# NOV Talent v2 Sprint 2 Recruitment UX

## 結果

既存機能と匿名Mockデータを再利用し、総務人事部が朝の確認を「結論 → 数字 → 今日やること」の順で進められる状態にした。

## 実装範囲

- Dashboard: 今朝の結論を最初に表示し、エントリー・見学・面接・内定・承諾・入社予定の6指標を続けて表示
- 今日やること: 既存データから最大5件だけ表示。AI判定や推測値は追加しない
- Candidate List: 既存の検索・絞り込み・並び替え・クイック表示を維持
- Candidate Detail: 接触・イベント・選考の履歴を区分し、件数を先に表示
- Event: 費用未登録時は金額ROIを推測せず、既存件数から到達率のみ表示
- Mock Runtime: loading / ready / empty / unauthorized / forbidden / validation_error / timeout / offline / maintenance を社員向け文言で表示
- Mobile: 390px幅を含む小画面で横スクロールを発生させない

## 境界

- Supabase、Production、JWT、Permissionは変更していない
- DB接続・書込み・schema変更・staging投入は実行していない
- NOV Peopleおよび社員管理は実装対象外
- 実個人情報は使用・表示していない

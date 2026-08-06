# Interaction仕様

| 操作 | 結果 | Loading／失敗 | Focus・状態保持 |
| --- | --- | --- | --- |
| 期間／scope変更 | Dashboard全projectionを再取得 | 旧値を当期値として残さずsection loading | controlへfocus維持、選択値保持 |
| 経営シグナル選択 | card selected、共通chartのmetric切替 | chartだけloading | cardへfocus、URL hash任意 |
| 推移期間切替 | 今年／前年系列を更新 | chartだけloading | pressed state維持 |
| 状態Filter | 許可集合内の一覧を絞る | 最後の操作を採用、前request abort | Filterとscroll startを保持 |
| sort | ascending／descending切替 | table/card領域のみloading | headerへfocus維持 |
| 店舗行／card | 店舗詳細Summaryへ | navigation中は対象行だけbusy | 戻り先row keyを保存 |
| Priority CTA | 関連店舗、tab、KPI anchorへ | detail取得失敗はdetail StatePanel | 戻る文脈を保存 |
| Detail tab | panel切替 | panelのみloading | tab keyboard、panel先頭へfocus |
| 再試行 | 同一条件で再request | button busy、重複送信不可 | 完了後section headingへannounce |

hoverは補助であり、hoverだけで情報を出さない。Tooltipはdelay 300ms、focusでも開き、Escで閉じる。 destructive操作はV1に存在しない。Animationは150–200ms、reduced motionでは無効。

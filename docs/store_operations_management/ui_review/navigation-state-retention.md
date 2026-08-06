# Navigation・状態保持仕様

## 遷移

DashboardのPriority Actionは対象店舗詳細の関連tabとKPI anchorへ、経営シグナルは同一画面の該当カードへ、店舗行／cardは店舗詳細Summaryへ遷移する。店舗詳細の「一覧へ戻る」は、遷移元が一覧なら一覧、Dashboard直行ならDashboardへ戻す。

## 保持する状態

対象月、月次／累計、表示範囲Filter、店舗状態、検索語、sort key／direction、表示列、scroll位置、選択中の経営シグナル／推移期間、詳細tab、遷移元をHistory stateへ保持する。URLで共有可能な対象月、Filter、sort、store ID、tabはquery/pathへ反映する。

Browser Back／「一覧へ戻る」は同じ復元規則を使う。復元後は元の店舗行または操作要素へfocusを戻し、scroll位置を復元する。SessionまたはScope versionが変わった場合はServerの最新許可集合で再検証し、権限外の保持値を破棄する。

## Scroll・Anchor

経営シグナルclickは該当カード上端をsticky filterの下へ合わせ、cardへfocusを移す。`prefers-reduced-motion`では即時移動する。Detail tab切替時はpage scrollを維持し、panel先頭へfocusを移す。Mobile filter sheetを閉じた後は起動buttonへfocusを戻す。

## Loading中の操作

同じrequestを発生させる操作だけをdisabledにする。page全体を無条件にlockしない。連続Filter変更は最後の選択を採用し、進行中requestをabortする。失敗時は選択条件を維持して再試行できる。

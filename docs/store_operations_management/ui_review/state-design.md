# 状態表示仕様

## 状態の優先順位

`unauthorized > forbidden > maintenance > offline > unavailable > validation_error > loading > preparing / collecting > empty > ready`。上位状態が画面全体を成立させない場合は下位状態を重ねない。部分取得失敗は該当sectionだけを置換する。

| 状態 | 適用範囲 | 見出し／本文 | 操作 | 禁止 |
| --- | --- | --- | --- | --- |
| loading | 初回のcontent領域 | 「データを取得しています。」 | なし | 集計中、0円、過去値を表示しない |
| collecting | KPI／利益領域 | 「売上データを集計しています。」／利益は「集計中」 | 確定予定があれば併記 | skeleton、0円禁止 |
| preparing | KPI／section | 「表示の準備をしています。」 | なし | 権限なし、データ0件と混同しない |
| empty | 一覧／Action | 「条件に該当する店舗はありません。」 | 「条件をクリア」または許可範囲の「すべて」 | 自動Filter変更禁止 |
| validation_error | 対象section | 「データの形式を確認できませんでした。」 | 「再読み込み」 | 不正値を表示しない |
| offline | content全体 | 「ネットワークに接続できません。」 | 「再試行」 | Session失効扱いにしない |
| maintenance | content全体 | 「現在メンテナンス中です。」 | 「HUBへ戻る」 | Retry連打を促さない |
| unavailable / 503 | 対象sectionまたは全体 | 「現在データを表示できません。」 | 再試行可能時のみ「再試行」 | Synthetic fallback禁止 |
| unauthorized | 全画面 | 「HUBログインが必要です。」 | 「NOV HUBへ戻る」 | 独自login禁止 |
| forbidden / 403 | 全画面 | 「この店舗を閲覧する権限がありません。」 | 「許可された一覧へ戻る」「HUBへ戻る」 | Empty表示禁止 |
| API未接続 | 全画面 | 「データ接続の準備中です。」 | 「HUBへ戻る」 | collectingへの置換禁止 |
| Preview | banner | 「営業部レビュー用のサンプルデータです。実績値ではありません。」 | なし | Productionで表示／有効化禁止 |

## 表示寸法

- 全画面状態はcontent max-width 720px、上余白64px、icon 24px、見出し20px、本文14px、主操作44px以上。
- section状態は元sectionの直近成功時の最小高を維持し、最低160px。KPI単位状態は値行24pxを維持する。
- Loading skeletonを使う場合は文字や数値を模した3段以内、animationは1.5秒以上。`prefers-reduced-motion`では静止する。
- Errorは色だけに依存せず、見出し、本文、状態iconを併用する。

## 利益の特別規則

confirmedは金額＋利益率＋確定対象期間、collectingは「集計中」＋予定、FCは「V1対象外」、Data Scopeなしは領域自体を非表示とする。0円は正式なconfirmed valueが0の場合だけ表示できる。


# IDEA NOV再設計方針

## 正本と適用範囲

確認できた共有正本は`portal/css/design-system.css`である。背景、文字、ブランド、alert／success、境界線、4〜24pxのspacing、6／8px radius、44px操作高、focus ring、システムフォントが定義されている。詳細なカード、テーブル、Tab、Filter、状態別の公式仕様書は確認できなかった。

## 現行ルール

- 背景: 白／薄いグレー
- 文字: `#1F1F1F`と`#767676`
- ブランド: `#E8B4B8`
- 境界: `#E5E5E5`／`#F0DFE1`
- spacing: 4、8、12、16、24px
- radius: 6、8px
- 操作高: 44px以上
- focus: ブランド色の外周ring
- font: system UIとNoto Sans JP

## 今回の暫定提案

- ブランド色は選択、リンク、主要操作に限定する
- 店舗状態は背景付きbadge＋状態名＋必要時icon、データ状態はneutralなicon＋文字にする
- Executive Summaryは影を強くせず、余白と罫線で一つの面を作る
- 優先アクションだけを独立カードにし、KPI単体カードを増やさない
- 主KPIは値、補助比較は小さな行、状態理由はcaptionの順にする
- 余白は24pxをセクション内、48〜64px相当をセクション間の暫定基準とする
- 13インチで本文14pxを下回らず、主要値は24〜32px相当を目安とする

## Design System側で確定すべき事項

- 店舗状態4種のsemantic colorとicon
- データ状態3種、system state 4種の表現
- Dashboard用タイポグラフィscale
- 比較テーブルのdensity、sticky header／column
- Accordion、bottom sheet、segmented controlの標準
- chart palette、pattern、凡例、tooltip
- empty／loading／errorの標準文章と領域

これらはStore Operations独自の恒久ルールにせず、IDEA NOV ERP共通部品として承認する。

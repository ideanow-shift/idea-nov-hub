# Store Sales Management Phase 5 UIレビュー

## 実施情報

- ブランチ: `feat/store-sales-management-phase5-prototype`
- ベースコミット: `8693988c195bf2ec74c365c9ebdf717eab35e8d4`
- 実施日: 2026-07-29
- 接続: ローカルHTTP serverとreview fixtureのみ
- 未実施: Supabase、DB、Storage、NOV HUB、IDEA LINK、外部API、deploy
- viewport:
  - PC: 1440 × 1000
  - タブレット: 768 × 1024
  - スマホ: 390 × 844

スクリーンショット21枚の合計は約0.83 MBで、UI回帰の基準画像として十分小さい。
Phase 5 review資料と一緒にGit管理する方針とする。なお、本レビューではcommitは作成していない。

## Fixture

### A. 経営者・全店舗

- 20店舗
- Needs Attention、Improving、Stable、Goodを含む
- Projectionが返す状態順
- Priority Actions 3件
- 利益確定済み
- 一部KPI準備中

### B. 店舗責任者

- 自店舗1件
- 利益率3指標
- 今月やること3件
- 他店舗へのリンクなし

### C. 未確定月

- Accounting確定状態は「集計中」
- 利益はcarry-forwardを使わず値なし
- 税込rule未承認の売上は「準備中」

### D. エラー・欠損

- validation error
- API timeout
- 空店舗一覧
- 全項目準備中

## 画面別レビュー

### Executive Dashboard

第一印象は、余白が十分で業務画面として硬すぎず、全社売上・利益・利益率の視線移動が
自然である。PCでは10秒以内に主要数値、要確認店舗数、Accounting metadataを認識できる。
右上の対象月・確定状態・最終更新も見つけやすい。

一方、スマホではAccounting metadataとSummary 7項目が縦に積み上がり、Priority Actionsが
最初のviewportから遠い。数字を見た後に行動を見る構成になっており、「行動につなげる」
目的に対して優先順位を再検討する余地がある。

また、review fixtureのAccounting対象月は2026-06だが、month inputは端末当月の2026-07を
表示している。対象月の二重表示が矛盾して見えるため、本番UIへ進む前に同期が必要。

カード数はSummaryで個別cardを乱立させず、区切り線によるmetric stripにしている点が良い。

### Priority Actions

PCでは3件が横並びで、状態、店舗、理由、推奨確認、詳細導線が一度に読める。
色以外にも`Needs Attention`文字がある。

3件すべて同一店舗になるfixtureでは、全社の優先順位というより同店舗のtask一覧に見える。
Store Detailの「今月やること」との役割差を明確にする必要がある。全社画面では店舗単位で
1件に集約する、または同一店舗の複数ruleをまとめる案がある。

### Business Drivers

Results / Customer / Value / Operationsの分類は理解しやすい。availableと準備中を同じ位置で
確認できる点もよい。

ただし、Valueに5行、Operationsに3行あり、スマホでは縦に長い。店舗一覧へ到達する前の
情報量が多い。初期表示を主要4〜6指標に絞り、残りを詳細または展開領域へ送る候補がある。
Total RepeatがCustomerとOperationsに重複する点も整理対象。

### Store List

PCでは20店舗の比較がしやすく、状態順も確認できる。状態badgeは文字付きで、色だけに
依存していない。sticky店舗名も比較時に有効。

スマホは11列tableの横スクロール依存が強い。初期viewportで店舗・区分・売上と営業利益の
一部までしか見えず、店舗状態が右端にあるためNeeds Attentionをすぐ確認できない。
モバイルでは店舗名の直下へ状態とデータ状態を表示するsummary row/card、または状態列を
店舗列の隣へ移す必要がある。

### Store Detail / Summary

「今月やること」がmetricより前にあり、3件の行動を明確に認識できる。店舗状態と理由も
見出し直下にあり、数字を見る前に目的が分かる。PC・スマホとも今回の中で最も良い情報階層。

スマホでは長い理由文とbadgeが近く、一部窮屈だが、意味は失われていない。

### Store Detail / Sales & Profit

指標の順序は売上構成から利益へ進むため自然。未取得ECは値を0にせず準備中になる。
PCでは3列gridが読みやすい。スマホは1列cardとなり、項目数が多いため縦に長い。
月次／累計の切替がまだ視覚的に明確でない。

### Store Detail / Customer & Repeat

Total Repeatを先頭に置き、New / Returning / Loyalなどは準備中として区別している。
未接続項目の多さが画面の主役になりやすいため、準備中項目をまとめる案がある。

### Store Detail / Value & Productivity

Ticket、Retail、MID、Productivityの分類は要件を網羅している。FTE由来項目を推測値に
していない点はよい。一方、利用可能項目より準備中項目が多く、現段階では情報密度に対する
意思決定価値が低い。準備中群を一つの説明blockへ畳む候補がある。

### Pending / Validation / Empty / Timeout

- Accounting metadataの「集計中」は明確。
- 税込rule未承認理由は表示される。
- `validation_error`は詳細metricで「データ確認が必要」と表示できる。
- timeoutは認証エラーと混同せず、再試行を促す。
- 空店舗fixtureではBusiness Driversの空配列処理でJavaScript errorが発生し、
  Store Listの空状態まで正常描画できない。`empty-store-list-mobile.png`は失敗状態の証跡。
- 全準備中fixtureでも数値の0補完はない。

問題として、Executive Summaryの`collecting` metricが見出し上は「準備中」と表示される。
Accounting metadataは「集計中」なのにmetricは「準備中」となるため、状態差が十分伝わらない。

## UIレビュー12項目

| 確認項目 | 判定 | 所見 |
|---|---|---|
| 10秒以内に重要情報が分かる | PC: 良 / Mobile: 条件付き | PCは良好。MobileはSummaryが長い |
| 今月やることが数字より先 | 良 | Store Detailで実現 |
| Needs Attentionが最上部 | PC: 良 / Mobile: 要改善 | sortは正しいがMobileでは状態列が画面外 |
| 対象月・確定・更新がすぐ分かる | 良 | header内で文字表示。ただしmonth inputとの不一致あり |
| カードが多すぎない | 概ね良 | Summaryはstrip。詳細Mobileは縦長 |
| Business Driversの情報量 | 要整理 | ValueとOperationsが長く、重複あり |
| Mobile横スクロール依存 | 要改善 | Store Listとtablistで強い |
| 店舗責任者が自店舗に集中 | 良 | 1店舗fixtureでは他店舗導線なし |
| 状態の違いが伝わる | 条件付き | collecting metricが準備中表示になる |
| 色だけに依存しない | 良 | 状態文字・理由・data stateを併記 |
| 数値と単位の優先度 | 良 | 金額・%を大きく表示 |
| tab・focus・ARIA | 概ね良 | tablist/tab/tabpanel/aria-selectedあり。横スクロール時のfocus視認を追加確認したい |

## Accessibility

良い点:

- heading階層がある
- Accounting情報は`dl`
- tableにcaption、column header、scroll領域の説明がある
- detail tabはtablist / tab / tabpanel / aria-selectedを使用
- noticeはaria-live
- statusは文字を併記
- focus-visible、44px操作高、reduced motionがある

確認・改善候補:

- ArrowLeft / ArrowRightによるtab移動は未実装
- mobile table横スクロール中のfocus位置をさらに分かりやすくする
- English statusに日本語補足を付ける
- `available`の「利用可能」は利用者価値が低いため「確定」等へ整理

## 現状の良い点

- Projection APIだけを使うUI境界が画面上でも一貫
- 「今月やること」が店舗詳細の最上位
- Accountingの更新タイミングが独立表示
- 欠損・未確定を0にしない
- 状態を色だけに依存させない
- PCで20店舗比較が可能
- detailの4tab構造が要件と一致

## 改善候補と優先度

### Must

1. month inputをProjectionの対象月と同期し、不一致をなくす
2. `collecting`を「集計中」、`preparing`を「準備中」、`validation_error`を
   「データ確認が必要」とmetric上でも正確に出し分ける
3. Mobile Store Listで店舗状態を横スクロールなしに確認可能にする
4. 店舗責任者scopeで全社表現や不要な全店舗UIが出ないことを明示する
5. 0店舗時のBusiness Drivers空配列を安全に扱い、空店舗一覧を正常描画する

### Should

1. Mobile ExecutiveでPriority ActionsをSummary全項目より前、または早い位置へ配置
2. Priority Actionsを店舗単位にまとめ、同一店舗3件の重複感を減らす
3. Business Drivers初期表示を絞り、Total Repeat重複を整理
4. detail tabのkeyboard arrow navigationを追加
5. 未取得項目が多いdetail tabでは準備中項目をgroup化
6. Store Listの状態表記を日本語併記

### Could

1. PC tableに表示列の選択やcompact表示を追加
2. mobile detailの長いmetric群へsection jumpを追加
3. filter選択件数を表示
4. 状態理由のtooltipではなく展開可能な補足を追加

## 次のUI改善案

次のUI改善turnでは、まずMust 1〜3だけを小さく修正し、同じfixtureとviewportで
before/after screenshotを比較する。その後、Priority ActionsとBusiness Driversの順序を
実利用者レビューで決める。Projection API、Status Engine、会計・KPIロジックは変更しない。

## スクリーンショット一覧

### PC

- `executive-desktop.png`
- `store-list-desktop.png`
- `store-summary-desktop.png`
- `sales-profit-desktop.png`
- `customer-repeat-desktop.png`
- `value-productivity-desktop.png`

### タブレット

- `executive-tablet.png`
- `store-list-tablet.png`
- `store-summary-tablet.png`

### スマホ

- `executive-mobile.png`
- `store-list-mobile.png`
- `store-summary-mobile.png`
- `sales-profit-mobile.png`
- `customer-repeat-mobile.png`
- `value-productivity-mobile.png`
- `store-manager-summary-mobile.png`
- `pending-state-mobile.png`
- `validation-error-mobile.png`
- `api-timeout-mobile.png`
- `empty-store-list-mobile.png`
- `all-preparing-mobile.png`

## 変更ファイル

- `portal/store-sales/review-fixtures.js`
- `portal/store-sales/app.js`
- `tests/store-sales-ui.test.mjs`
- `docs/store_sales_management/phase5/ui-review/*.png`
- `docs/store_sales_management/phase5/ui-review/ui-review-notes.md`

Accounting Core、KPI Engine、Store Sales Projection API、Store Status Engineは変更していない。

## 実行方法

リポジトリの`portal`をローカルHTTP serverで配信し、次のreview専用queryを使う。

- `store-sales/?fixture=executive`
- `store-sales/?fixture=manager`
- `store-sales/?fixture=pending`
- `store-sales/?fixture=validation`
- `store-sales/?fixture=timeout`
- `store-sales/?fixture=empty`
- `store-sales/?fixture=all-preparing`

`fixture`指定時はsession復元や`callApiAction`より前にローカルfixtureを読み込むため、
外部APIへ接続しない。

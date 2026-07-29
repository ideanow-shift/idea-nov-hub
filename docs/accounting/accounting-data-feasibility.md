# Accounting Data Feasibility

## 判定基準

- **Available**: 原本に明示行・列があり、直接取得できる。
- **Derivable**: Availableな原本と承認済み式から算出できる。
- **Unavailable**: 対象原本に存在せず、算出根拠もない。
- **Unknown**: 候補はあるが、業務意味・期間・mappingの追加確認が必要。

`Available`はExcel内での取得可否であり、Core ID mappingや経理確定を経ずに本番表示できる意味ではない。

## 1. 店舗・部門候補別P/L

| 項目 | source row | 判定 | 根拠・加工 | 留意点 |
|---|---|---|---|---|
| 技術売上 | 技術売上高 | Available | 直接取得 | 税抜。店舗営業V1の税込表示には変換契約が必要 |
| 商品売上 | 商品売上高 | Available | 直接取得 | MID売上の独立行なし |
| EC売上 | ECサイト商品売上高 | Available | 直接取得 | 店舗按分前の会計帰属を確認 |
| その他売上 | 該当行なし | Unavailable | 管理収入等は営業外収益であり売上へ読み替えない | 新科目または別原本が必要 |
| 売上高合計 | 売上高合計 | Available | 直接取得 | 税抜 |
| 材料仕入 | 材料仕入 | Available | 直接取得 | 材料費表示との定義差を確認 |
| 売上原価 | 売上原価 | Available | 直接取得 | 棚卸を含む |
| 売上総利益 | 売上総損益金額 | Available | 直接取得。売上－原価でも再計算一致 | 名称を正規化 |
| 人件費 | 単一行なし | Derivable | 承認済み人件費科目集合をSUM | 役員報酬、退職金、福利厚生の含有判断が必要 |
| 販売費及び一般管理費 | 販売管理費計 | Available | 直接取得 | source名称は販売管理費 |
| 営業利益 | 営業損益金額 | Available | 直接取得。粗利－販管費でも一致 | 負数を損失として保持 |
| 経常利益 | 経常損益金額 | Available | 直接取得 | 営業外収益・費用を含む |
| 税引前利益 | 税引前当期純損益金額 | Available | 直接取得 | 特別損益を含む |
| 当期利益 | 当期純損益金額 | Available | 直接取得 | 法人税等反映後 |
| 各科目の月次値 | B:G、I:N | Available | 月見出しからfiscal monthへ変換 | 7月重複、8月ゼロは対象月状態を確認 |
| 各科目の累計値 | H/O/P/Q/R | Available | 半期、仮残高、決算、当期残高を別amount typeで取得 | dashboard累計は月次SUMとも照合 |

## 2. B/S

| 項目 | source row | 判定 | 補足 |
|---|---|---|---|
| 現金預金 | 現金･預金合計 | Available | 補助科目はprivate扱い |
| 売掛金 | 売掛金 | Available | 売上債権合計もあり |
| 棚卸資産 | 棚卸資産合計 | Available | 原材料・商品・貯蔵品の明細あり |
| 流動資産 | 流動資産合計 | Available | 直接取得 |
| 固定資産 | 固定資産合計 | Available | 有形・無形・投資その他を含む |
| 資産合計 | 資産合計 | Available | 貸借checkに使用 |
| 買掛金 | 買掛金 | Available | 仕入債務合計もあり |
| 短期借入金 | 短期借入金 | Available | 直接取得 |
| 長期借入金 | 長期借入金 | Available | 直接取得 |
| 流動負債 | 流動負債合計 | Available | 直接取得 |
| 固定負債 | 固定負債合計 | Available | 直接取得 |
| 負債合計 | 負債合計 | Available | 直接取得 |
| 純資産 | 純資産合計 | Available | 直接取得 |
| 負債純資産合計 | 負債･純資産合計 | Available | 資産合計と全列一致 |

部門別B/Sシートは存在するが、法的B/Sではなく会計部門配賦の可能性がある。店舗営業V1へそのまま表示せず、法人経営管理で使用する前に経理が用途を承認する。

## 3. 集計粒度

| 粒度 | 判定 | 根拠 | production利用条件 |
|---|---|---|---|
| 全社 | Available | `全体(合計)` B/S・P/L | 単一事業所内の全社 |
| 法人別 | Available | A3に単一法人名 | 今回は1法人のみ。他法人ファイルは未確認 |
| 直営店別 | Unknown | BASSA/KYARAの個別sheetあり | Core `store_type`と法人帰属を管理者確認 |
| FC法人別 | Unknown | FC群・個別sheetはあるが法的法人IDなし | FC法人と会計部門の対応表が必要 |
| FC店舗別 | Derivable | FC個別sheetを店舗へmapping可能 | 初回手動確認とCore store UUID固定 |
| 部門別 | Available | 本部・教育・営業・総務・経理・EC等 | Core department mappingが必要 |
| 月別 | Available | 12か月見出しあり | 確定対象月と未来月0を区別 |
| 会計期間累計 | Available | 半期、仮残高、決算、当期残高あり | monthly SUMとsource累計をreconcile |

## 4. 店舗営業管理V1

### Results

| UI項目 | 判定 | V1利用方法 |
|---|---|---|
| 売上 | Unknown | 税抜値はAvailableだが、確定仕様は税込表示。税変換または別売上原本の承認待ち |
| 売上総利益 | Available | confirmedな店舗・部門P/Lから表示 |
| 営業利益 | Available | confirmedな営業損益金額 |
| 経常利益 | Available | confirmedな経常損益金額 |
| 利益率 | Derivable | 各利益÷同一税区分の売上。ゼロ分母をguard |
| 前月比 | Derivable | 同一entity/accountの連続月を比較 |
| 前年同月比 | Unavailable | 前会計年度データなし |
| 予算比 | Unavailable | 予算列なし |
| 月次 | Available | 2025年9月〜2026年6月候補。7月はUnknown |
| 累計 | Available | source累計を表示し、月次SUMと照合 |

### Value

| UI項目 | 判定 | V1利用方法 |
|---|---|---|
| 技術売上 | Available | 税抜source。税込表示には変換契約が必要 |
| 商品売上 | Available | 商品売上高 |
| EC売上 | Available | ECサイト商品売上高。店舗按分は別rule |
| その他売上 | Unavailable | 該当科目なし |
| 売上構成比 | Derivable | 各売上÷売上高合計 |

### Expenses

| UI項目 | 判定 | V1利用方法 |
|---|---|---|
| 人件費 | Derivable | approved account setのSUM |
| 材料費 | Available | 材料仕入を候補表示。正式定義の承認は必要 |
| 家賃 | Unknown | `賃借料`はあるが、店舗家賃・設備leaseの区別なし |
| 広告宣伝費 | Available | 直接取得 |
| 水道光熱費 | Available | 直接取得 |
| 主要販管費 | Available | 販管費明細をaccount mapping経由で表示 |

集計は **Available 12 / Derivable 4 / Unavailable 3 / Unknown 2**（上記V1の21項目）。

## 5. 会計Excelだけでは取得しない項目

次はUnavailableとして会計値から推定しない。

- 客数、新規客数、既存客数
- 総・新規・再来・固定リピート率
- 客単価
- FTE、生産性
- 商品購入客数・商品購入率
- POS上の値引、取消、返品、来店履歴

## 6. 表示状態

| Accounting state | UI | 金額表示 |
|---|---|---|
| preparing | 準備中 | 非表示 |
| collecting | 集計中 | 管理者previewのみ |
| confirmed | 確定値 | 権限内で表示 |
| error | エラー | 非表示、issue表示 |
| superseded | 修正版あり | 通常画面から除外、履歴閲覧のみ |

未取込・未確定・未来月を0円として表示しない。

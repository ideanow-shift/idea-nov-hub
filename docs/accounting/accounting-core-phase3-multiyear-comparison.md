# Accounting Core Phase 3 — 第11〜13期比較

## 結論

第11〜13期は、同一の`YayoiExcelAdapter`で原本を変更せず読み取れた。
年度差異をheader・科目・context・有効期間で吸収する方式は **Conditional
Go**。3期の構造は十分近いが、entity再編、売上科目体系変更、補助科目変更、
同一月値異常があるため、未知差分を自動承認せずblockingにする必要がある。

原本、金額、口座ラベル全文はGitへ保存していない。B/Sの口座・補助科目差分
は本書でマスクし、private mapping対象とする。

## 原本別監査結果

| 項目 | 第11期 | 第12期 | 第13期 |
|---|---:|---:|---:|
| 対象期間 | 2023-09〜2024-08 | 2024-09〜2025-08 | 2025-09〜2026-08 |
| シート | 62 | 70 | 76 |
| B/S / P/L | 31 / 31 | 35 / 35 | 38 / 38 |
| entity候補 | 31 | 35 | 38 |
| account context key | 172 | 173 | 173 |
| raw value | 90,627 | 102,918 | 111,741 |
| B/S行形 | 130/131 | 130/131 | 130/131 |
| P/L行形 | 86 | 87 | 87 |
| 会計式check | 3,162 | 3,570 | 3,876 |
| 会計式不一致 | 0 | 0 | 0 |
| 同一月値warning/blocking | 8 / 8 | 11 / 11 | 42 / 42 |
| confirmed through | 2024-08 | 2025-08 | 2026-06 |

hashは監査時に照合したが、本書には全文を保存しない。

## シート・列構造

3期共通:

- A1 帳票種別、A3事業所、A5集計期間、A6税区分、A8科目anchor
- 月列は9月〜翌8月
- 上半期・下半期残高
- 当期仮残高、決算残高、当期残高
- 実データ範囲A:R。書式上のused rangeはIV列まで
- 税抜出力
- B/SとP/Lが同一entity名で対になる

差分:

- P/Lは第11期86行、第12・13期87行。第12期から固定資産除却損が追加
- sheet数の増加はentity追加・再編による
- 月次・累計・決算列の名称と順序に差分なし

adapterはA5の和暦開始日を西暦へ変換する。従来の第13期固定年度を廃止した
ため、3期を正しい月へ正規化できる。

## Entity増減・名称変更候補

### 第11期 → 第12期

追加:

- FC東久留米
- FC立川
- 教育･アカデミー
- 本部･教育(共通)
- 本部･教育(合計)

消滅:

- 本部･教育

`本部･教育`は単純改名と確定せず、「合計＋アカデミー＋共通」への組織／
会計集計再編候補としてproposedにする。

### 第12期 → 第13期

追加:

- BASSA立川店
- EC事業部
- FCロアネ

消滅なし。

年度有効期間候補は`yayoi-entity-effective-periods.csv`に分離した。Core UUID
はすべてUnknownで、管理者approved前はpublish不可。

## 勘定科目差分

### 第11期 → 第12期

- P/L特別損失に`固定資産除却損`が追加

### 第12期 → 第13期

追加:

- 技術売上高
- 商品売上高
- ECサイト商品売上高
- B/S private補助科目1件（マスク）

消滅:

- 単一の売上高
- 非課税表記付きロイヤリティ収入
- 非課税表記付き業務受託収入
- B/S private補助科目1件（マスク）

売上体系は単純名称変更ではなく、単一売上から技術・商品・ECへの分類拡張
候補である。旧年度の売上を新分類へ推測配分してはならない。

`yayoi-account-aliases.csv`で旧名称、全半角、税区分suffixをcanonical source
nameへ結び、有効期間を保持する。aliasはproposedであり自動承認しない。税区分
は科目名文字列からcanonical amountへ混入させず、将来tax metadataへ分離する。

## 3期Validation

実施対象:

- B/S 資産合計＝負債・純資産合計
- 売上高－売上原価＝売上総利益
- 売上総利益－販管費＝営業利益
- 営業利益＋営業外収益－営業外費用＝経常利益
- 経常利益＋特別利益－特別損失＝税引前利益
- 税引前利益－法人税及住民税＝当期利益
- 6月・7月の異常な同一値

会計式は10,608/10,608件で不一致なし。第11期8sheet、第12期11sheet、
第13期42sheetで6月・7月同値を検出した。cutoff後は
`UNCONFIRMED_PERIOD_CARRY_FORWARD`、確定期間内は
`PERIOD_DUPLICATE_CAUSE_UNKNOWN`として、いずれもblockingとする。

### 期間重複の再分類

| 期 | B/S非ゼロ同値 | P/L全ゼロ | P/L非ゼロ同値 | 合計 |
|---|---:|---:|---:|---:|
| 第11期 | 3 | 5 | 0 | 8 |
| 第12期 | 4 | 7 | 0 | 11 |
| 第13期 | 4 | 7 | 31 | 42 |
| 合計 | 11 | 19 | 31 | 61 |

- 実際の月次重複: 6月・7月のsource月列が科目集合として完全一致した61sheet
- 未入力月への前月値引継ぎ: 第13期42sheet。経理確認済みの弥生標準出力仕様
- 累計列・決算列の帳票仕様: 検出対象に混入した件数0
- adapter誤検出: 0
- 原因未確認: 19（第11期8、第12期11。確定期間内の同値）

第13期の42件は`cause=UNCONFIRMED_PERIOD_CARRY_FORWARD`、
`closing_status=pending`、`publish_allowed=false`、`data_state=preparing`。
第11・12期は確定期間内であるため、同値だけを根拠にcarry-forwardへ
自動分類せず`UNKNOWN`のblockingを維持する。61件すべてblockingである。

mapping validationを含めると、全entity/accountは承認状態の年度適用確認が
必要であり、実データをそのままpublishしない。

## Import Engineの年度差異吸収

吸収可能:

- 和暦年度の違い
- entity数・sheet数の増減
- P/L行数86/87
- 科目追加・削除
- account aliasと全半角差
- summary/leaf scopeの増減

blockingにすべき未知差分:

- 必須anchorまたは17列構造の欠落・重複
- 税基準変更
- B/S/P/L pair欠落
- 未知statement prefix
- 同一contextの科目衝突
- 未承認entity/account
- 月順序・会計開始月変更
- summaryとleafの二重集計
- 会計式不一致

よって3期取込は技術的に可能だが、差分の自動承認は不可。

## 第14期以降の評価

設計は位置固定ではなくsemantic anchorとmapping versionを使うため、同系統の
標準出力なら継続可能性が高い。安全条件:

1. fileごとにlayout signatureを作り、既知signatureとの差を記録
2. A1/A3/A5/A6/A8、月列集合・順序、B/S/P/L pairを必須検証
3. 新entity・科目・contextはproposedで停止
4. mappingに`effective_from/to`を持たせ、過去実績を現行名称で上書きしない
5. account codeが利用可能になれば名称より優先する
6. private補助科目は暗号化されたprivate mappingへ分離
7. 新年度はsynthetic regressionと実原本validation後にadapter compatibilityを承認

会計開始月、帳票形式、列体系、税基準が変わる場合は新layout adapter version
が必要であり、現adapterが黙って取り込まないことを正しい動作とする。

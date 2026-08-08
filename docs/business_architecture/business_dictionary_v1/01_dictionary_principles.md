# Dictionary principles

## Contract rules

1. 用語は`term_id`で安定識別し、表示名をidentityにしない。
2. 日本語表示名、`technical_key`、aliasesを分離する。
3. Core identityはemployee=`public.employees.id`、store=`public.stores.id`、corporation=`public.corporations.id`をAdapter越しに参照する。
4. 現行Spreadsheet、UI、CSVの構造はevidenceであり、正本や正式定義ではない。
5. 未確認のsource、式、分子、分母、期間、税基準はConfirmedにしない。
6. 0除算は0ではなくNULL/算定不可とする。
7. 丸めは表示時に行い、中間計算精度を保持する。
8. 訂正は上書きせずsource/version/correction reason/approved byを残す。
9. missing、zero、not applicable、pendingを区別する。
10. 直営/FC、店舗改廃、月中異動、応援勤務をedge caseとして明示する。
11. accessはroleだけでなくcorporation/store/area scope、action、record stateで評価する。
12. 定義変更はeffective dateとversionを上げ、既存集計への影響を記録する。

## Status rules

| status | 使用条件 |
|---|---|
| Confirmed | 既存の承認済みCore contractまたは物理canonical IDで裏付けられる |
| Proposed | 技術的・業務的に妥当な候補だがowner承認前 |
| Needs Business Decision | 複数の有効な業務選択肢があり、技術判断で固定できない |
| Unknown | sourceまたは現行意味を確認できない |
| Deprecated | 使用停止が承認された定義 |
| Legacy | 移行期間中だけ参照する旧定義 |

## Change control

変更提案には変更理由、owner、影響するterm_id、計算再実行範囲、effective date、旧versionの参照維持、承認者を必要とする。Confirmed化はPhase 2以降の業務承認で行う。

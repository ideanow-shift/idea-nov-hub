# 02 Keep / Rebuild Matrix

## 判定ルール

| 区分 | 意味 |
| --- | --- |
| KEEP | 現行責任・データ契約を維持する |
| IMPROVE | 現行を稼働させたまま、欠陥・境界・運用を改善する |
| MIGRATE | 新しい独立Webアプリへ機能を移す |
| FREEZE | 新規変更を止め、参照・緊急修正のみのLegacyにする |
| REVIEW | 用途、所有者、ライブ利用、正本が未確定 |

判定は削除許可ではない。FREEZE/REVIEWも保持し、廃止候補は90日以上の利用証跡、所有者、復旧手順、法令保存期間を確認する。

## Core・HUB

| 機能/資産 | 区分 | 理由・移行先 |
| --- | --- | --- |
| スタッフマスタ | KEEP | 完成済みCore Masterとして保護 |
| 店舗マスタ | KEEP | 全店舗系データのID境界 |
| 法人マスタ | KEEP | 全法人系データのID境界 |
| departments/positions/job_types/roles | IMPROVE | 共通参照を維持。正本・変更責任をADR化 |
| Firebase login | KEEP | NOV HUB共通本人認証 |
| Firebase UID/email→employee解決 | IMPROVE | 二重マスタ・email fallbackの曖昧さを解消する設計が必要 |
| employee_rolesとscope認可 | IMPROVE | Backend強制、assigned scope未実装部分を整備 |
| `portal_apps` アプリ一覧 | IMPROVE | DBとfixed/apps.json fallbackの二重経路を整理 |
| HUB app handoff/session | IMPROVE | 短寿命・audience・replay防止・アプリ別監査を標準化 |
| access logs | KEEP | 新旧並行利用と廃止判断の証跡 |
| `core.*` と `public.*` 同名マスタ | REVIEW | 削除・同期・置換禁止。正本宣言とread adapterを先に決定 |

## 法人経営管理

| 既存機能 | 区分 | 理由 |
| --- | --- | --- |
| 法人別P/L・B/S・CF参照 | KEEP | 実データとFKがあり、法人経営の中核 |
| 月次資金位置 | KEEP | 法人財務責任 |
| 部門別P/L・月次人員数 | IMPROVE | Core組織・人員履歴との時点整合が必要 |
| 財務原本取込・source document | IMPROVE | raw/正規化/確定値の正本契約を固定 |
| 勘定科目分類ルール | IMPROVE | draft/review/approved状態、store/corporation scopeを明確化 |
| Management `finance` タブ | KEEP | 現行read-only画面として維持可能 |
| Management `dataops` タブ | IMPROVE | 取込・承認は別権限。現状は状態表示に限定 |
| ローカルP/L・B/S preview | FREEZE | 本番保存なしの検証資産として凍結し、正式取込UIへ再設計 |
| Expense Hub申請・承認・精算 | KEEP | 独立したfinance機能として稼働骨格あり |
| 月次締め・会計CSV・出力履歴 | IMPROVE | v1/v2 RPC併存、権限、lint/driftを別タスクで修正 |
| finance AI助言・専門家コメント | REVIEW | 静的利用未検出。所有者・運用確認が必要 |
| finance external viewers/access | REVIEW | セキュリティ境界のライブ確認が必要 |
| 稟議 | REVIEW | 法人経営に隣接するが本タスク4領域の所有者未確定 |

## 店舗営業管理

| 既存機能 | 区分 | 理由・移行先 |
| --- | --- | --- |
| Management `stores` タブ | MIGRATE | 新店舗営業Webアプリの店舗サマリーへ |
| 店舗別売上・利益分析 | MIGRATE | 新アプリの中核。原票正本を先に決定 |
| POS Sales MVP静的prototype | FREEZE | UI/指標の参考資産。DB接続なし |
| POS Ops prototype（会計待機・レジ・予約表） | REVIEW | 店舗営業に含めるか、POS専用アプリに分けるか要承認 |
| `management_checks/items/results/photos` | MIGRATE | 店舗運営チェックとして新アプリへ |
| `management_improvement_actions` | MIGRATE | 店舗改善タスクへ。法人施策との共有境界を定義 |
| `management_performance_snapshots` | MIGRATE | 集計スナップショットとして利用。売上原票にはしない |
| `management_performance_initiatives` | MIGRATE | 店舗施策へ |
| `store_business_profiles` | MIGRATE | 店舗補足。Core店舗基本情報を上書きしない |
| `concierge_store_credentials` | REVIEW | Concierge固有認証であり店舗営業の正本にしない |
| shift/attendance参照 | KEEP | 勤怠・シフト所有。店舗営業はread-only利用 |
| 既存management DB CRUD | REVIEW | 監査で静的利用未検出。ライブquery logと所有者確認が必要 |

## 求人管理

| 既存機能 | 区分 | 理由 |
| --- | --- | --- |
| 候補者 `talent_students` | KEEP | 701件の既存資産。正本候補 |
| 学校・就職フェア | KEEP | 採用ソース・ROI管理 |
| 見学・希望店舗・面接・内定 | KEEP | 求人ファネルの中核 |
| follow-up/next action | KEEP | 候補者進捗管理 |
| 採用年度/cohort | IMPROVE | 年度定義と28卒等の表示規則を明文化 |
| 採用費用・ROI | IMPROVE | cost attributionと法人帰属を確定 |
| Talent dashboard | KEEP | read-only集計画面 |
| `/api/talent/v1/dashboard/summary` | IMPROVE | サーバー実体・認可・RLSを確認 |
| onboarding case/check items | IMPROVE | 入社変換の唯一の引継ぎcaseとして契約化 |
| `nov_talent_applications_v1`/funnel/profile | REVIEW | 0件・静的未使用。旧talentとの正本競合 |
| nov_talent historical staging/mapping | FREEZE | 履歴取込専用。通常業務更新から隔離 |
| nov_talent profile/workforce RPC | REVIEW | 複数lint error。修正前に本番利用禁止 |

## 現職者管理

| 既存機能 | 区分 | 理由・移行先 |
| --- | --- | --- |
| HR Backoffice dashboard全画面 | FREEZE | dummy dataのDB未接続preview。Legacy参考資産 |
| 社員一覧・詳細 | MIGRATE | 新現職者管理。基本情報はスタッフマスタread-only |
| 配属・役職・等級・雇用履歴 | MIGRATE | 履歴/関連テーブルで管理 |
| `employee_assignment_histories` | KEEP | 504件のCore関連履歴。新アプリから利用 |
| `employee_store_assignments` | KEEP | 473件の兼務/店舗配属 |
| employee roles | KEEP | 共通認可資産。現職者アプリが勝手に再定義しない |
| hr profiles/addresses/bank/commute/contracts | MIGRATE | PII・労務情報として新アプリへ |
| family/social/labor/tax | MIGRATE | 高機密の現職者領域 |
| employee documents + signed URL API | IMPROVE | Storage policy、監査、最小権限を確認後に新アプリで利用 |
| onboarding受入 | MIGRATE | 求人管理から承認済みcaseを受領 |
| workforce procedure cases/steps | REVIEW | 0件・lint errorあり。新モデル候補として設計比較 |
| `public.employees`の所属・雇用属性直書き | IMPROVE | 現在値は互換表示。履歴の正本を別関連テーブルに寄せる設計 |
| employee import raw/jp | FREEZE | stagingとして凍結。通常参照から隔離 |

## 廃止候補

現時点では物理廃止を決定しない。次だけを「廃止候補レビュー」に送る。

1. 90日間query/Edge/GAS/BI/手動利用がゼロの静的未使用資産。
2. `nov_talent_*` のうち、旧talentモデルと重複し、かつ正本に採用されなかった0件テーブル/RPC。
3. 新アプリ切替後の旧Management stores UIとHR preview。
4. 重複マスタは廃止候補に含めない。Core Master保護方針により別承認が必要。


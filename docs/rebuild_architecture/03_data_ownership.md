# 03 Data Ownership

## 原則

1. 正本は「最新値を更新できる唯一の業務責任」を意味する。参照コピー、集計、View、キャッシュは正本ではない。
2. スタッフ・店舗・法人の基本情報は完成済みCore Masterを正本として保護する。
3. 現状の物理正本候補は件数・FK・参照量から `public.employees / public.stores / public.corporations`。ただし `core.*` 並存のため、ADR承認までは「論理正本=Core Master、物理正本=要承認」と表記する。
4. 不足属性はCore Masterへ無断追加せず、履歴・関連・private profile・Viewで補う。
5. 参照アプリはCore Masterを更新しない。更新はCore Master管理責任者の承認済みAPIだけを通す。

## Coreと認証

| データ | 論理正本/物理候補 | 更新責任 | 参照アプリ | 備考 |
| --- | --- | --- | --- | --- |
| スタッフ基本情報 | Core Staff / `public.employees`候補 | Core Master管理 | 全4アプリ、HUB | `core.employees`とのADR必須 |
| 店舗基本情報 | Core Store / `public.stores`候補 | Core Master管理 | 全4アプリ、HUB | 店舗営業は名称・法人所属を複製しない |
| 法人基本情報 | Core Corporation / `public.corporations`候補 | Core Master管理 | 全4アプリ、HUB | 法人経営も基本情報を所有しない |
| 部署 | `public.departments`候補 | Core Master管理 | 法人経営、現職者、HUB | 履歴時点の部署名はView/スナップショットで再現 |
| 役職 | `public.positions`候補 | Core Master管理 | 現職者、HUB | 等級とは分離候補 |
| 職種 | `public.job_types` | Core Master管理 | 求人、現職者、HUB | 求人の募集職種と雇用後職種をmapping |
| アプリロール | roles + employee_roles | OS/Core認可管理 | HUB、全4アプリ | 業務データではなく認可正本 |
| Firebase本人識別 | Firebase Auth | 認証管理者 | HUB、gateway | emailはfallback。`firebase_uid` linkを監査 |
| Firebase UID対応 | employeeの`firebase_uid`または専用link契約 | Core認証連携責任 | gatewayのみ | 二重マスタへ別々に書かない |
| アプリ一覧 | `portal_apps` | NOV HUB運用 | HUB | `apps.json`はfallback/表示辞書 |
| アクセス監査 | `access_logs` | NOV HUB/OS | セキュリティ、各owner | app_idを新旧で分ける |

## 法人経営管理が所有

| データ | 正本テーブル/候補 | 更新責任 | 参照 |
| --- | --- | --- | --- |
| 財務取込原本メタデータ | `finance_source_documents` | 経理 | 法人経営 |
| 会計raw | `finance_accounting_monthly_raw` | 経理取込 | 法人経営 | Legacy表記だが削除しない |
| 法人月次P/L | `finance_monthly_corporate_pl` | 経理確定処理 | 法人経営、店舗営業は集計参照 |
| 法人月次B/S | `finance_monthly_corporate_bs` | 経理確定処理 | 法人経営 |
| CF/資金位置 | `finance_monthly_cash_positions` | 経理 | 法人経営 |
| 部門P/L | `finance_monthly_department_pl` | 経理 | 法人経営 |
| 月次人員スナップショット | `finance_monthly_staff_counts` | 法人経営の集計処理 | 法人経営 | スタッフ正本ではない |
| 分類ルール | `finance_account_classification_rules` | 経理承認者 | 法人経営、店舗営業の集計 |
| 経費申請・領収書 | `finance.expense_claims/receipts` | 申請者・承認者・経理 | 法人経営/Expense Hub |
| 月次経費報告・締め | `finance.monthly_expense_reports/closes` | 経理 | 法人経営 |
| 会計出力履歴 | accounting export tables/views | 経理 | 法人経営 |

## 店舗営業管理が所有

| データ | 正本/候補 | 更新責任 | 参照 | 注意 |
| --- | --- | --- | --- | --- |
| 店舗売上原票 | **未確定**。外部POS/SalonAnswer/CSV候補 | 店舗営業+経理承認 | 店舗営業、法人経営 | `performance_snapshots`を原票と誤認しない |
| 店舗日次/月次KPI | `management_performance_snapshots`候補 | 店舗営業集計 | 店舗営業、法人経営 | source_detailと確定状態が必要 |
| 店舗運営チェック | management_checks/items/results | 店長・担当部門 | 店舗営業 |
| チェック写真 | management_check_photos + Storage候補 | 実施者 | 店舗営業 | Storage policy未確認 |
| 店舗改善アクション | management_improvement_actions | owner/店長 | 店舗営業、法人経営は集計参照 |
| 店舗施策 | management_performance_initiatives | 店長/営業責任者 | 店舗営業 |
| 店舗業務プロフィール | store_business_profiles | 店舗営業管理者 | HUB、店舗営業 | Core店舗基本情報の拡張のみ |
| POS取引・明細・支払 | **新規候補、未設計** | 店舗/POS | 店舗営業、法人経営集計 | prototypeは保存しない |
| 予約/顧客PII | 本タスクでは所有未決定 | 別承認 | 店舗営業候補 | MVP外 |

## 求人管理が所有

| データ | 正本/候補 | 更新責任 | 参照 | 注意 |
| --- | --- | --- | --- | --- |
| 候補者 | `talent_students`（現行候補） | 採用担当 | 求人管理 | 701件。nov_talentとの競合要解決 |
| 応募/選考 | talent現行列または`nov_talent_applications_v1`候補 | 採用担当 | 求人管理 | 物理正本はowner承認が必要 |
| 見学履歴 | talent_student_store_tour_histories | 採用担当/店舗 | 求人管理、店舗営業は予定参照 |
| 希望店舗 | talent_student_store_preferences | 候補者/採用担当 | 求人管理 | Core store FK |
| 面接・内定イベント | 現行talentまたはfunnel_events候補 | 採用担当 | 求人管理 |
| 就職フェア | talent_fairs | 採用担当 | 求人管理 |
| 学校 | talent_schools | 採用担当 | 求人管理 |
| 採用費用/ROI | fairs + investment settings/View | 採用責任者 | 求人管理、法人経営集計 |
| 採用年度 | fiscal year/cohort契約 | 採用責任者 | 求人管理 | JST年度計算と「28卒」を別フィールド概念にする |
| 入社引継ぎcase | talent_employee_onboarding_cases/check_items | 求人管理が作成、現職者が受入 | 求人・現職者 | 共有workflow。所有移管点を状態で表す |

## 現職者管理が所有

| データ | 正本/候補 | 更新責任 | 参照 | Coreとの境界 |
| --- | --- | --- | --- | --- |
| 配属履歴 | employee_assignment_histories | 人事 | 現職者、HUB、法人経営集計 | employee/store/corporation FK |
| 店舗兼務履歴 | employee_store_assignments | 人事 | 現職者、店舗営業 | 現在所属表示をCoreへ投影する場合は承認API |
| 雇用契約 | hr.employee_contracts | 人事 | 現職者 |
| 雇用履歴 | hr.employee_historyまたは新履歴候補 | 人事 | 現職者 |
| 住所/家族/口座 | hr.employee_addresses/family_members/bank_accounts | 本人・人事 | 現職者のみ | Core基本情報へ入れない |
| 通勤 | hr.employee_commutes | 本人・人事 | 現職者、経費 |
| 社保/労保/税 | hr.employee_social_insurance/labor_insurance/tax_profiles | 人事限定 | 現職者 |
| 人事書類 | hr.employee_documents | 本人・人事 | 現職者 | signed URL、path非露出 |
| 人事手続case | workforce procedure tables候補 | 人事 | 現職者 | 0件モデルの採否を要承認 |
| 入社日・退職日・在籍状態 | Coreスタッフの現行値 + 履歴 | 人事が申請、Coreが確定 | 全アプリ | Coreを直接編集しない |
| 評価・教育 | 各専用システム | 各owner | 現職者はsummary参照 | 詳細を複製しない |
| 勤怠 | 勤怠システム | 勤怠owner | 現職者は集計参照 | 打刻原本を所有しない |

## 採用から入社への所有移管

1. 求人管理が候補者・選考・内定・入社予定を所有。
2. `onboarding_case` を作り、本人同意済み項目、予定法人/店舗/職種、入社予定日、必要書類チェックを固定。
3. 現職者管理がcaseを受入・検証する。受入前はスタッフマスタを作らない。
4. Core Master管理の承認済みAPIでemployeeを採番または既存employeeへlink。
5. onboarding caseへ `employee_id` を記録し、その後の労務情報は現職者管理が所有。
6. 求人管理は選考履歴を保持するが、入社後の住所・口座・契約更新を持たない。

## 禁止する重複

- 新アプリ独自のstaff/store/corporation master。
- 候補者からemployeeへ変換後も、同じ現住所・口座・雇用契約を求人側で更新すること。
- 店舗売上原票と法人P/Lを同じ「売上」列として相互上書きすること。
- Core employeeの現在所属だけで過去月の人員・店舗実績を再計算すること。
- Firebase UIDを複数employee IDへ紐付けること。


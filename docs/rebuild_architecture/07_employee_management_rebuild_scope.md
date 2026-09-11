# 07 Employee Management Rebuild Scope

## 目的

入社後の配属、雇用、労務PII、書類、手続履歴を一つの独立Webアプリで管理する。スタッフ基本情報の新マスタは作らず、Core Staffを参照し、不足は履歴・関連・private領域で補完する。

## 対象ユーザー

| Role | 主な操作 |
| --- | --- |
| 人事/労務管理者 | 入社受入、契約、配属、保険、税、退職 |
| 人事担当 | 担当法人/部署のcase処理 |
| 店長/上長 | 限定された所属・手続状態の参照/承認 |
| 本人 | 自分の住所、通勤、口座、書類提出 |
| 経営者 | 個人PIIを除く人員summary |
| 監査 | 変更履歴、閲覧履歴、権限レビュー |

## 必要機能

1. 社員ディレクトリと在籍/休職/退職状態。
2. 求人管理からのonboarding case受入。
3. 配属、兼務、役職、等級、雇用形態のeffective-dated履歴。
4. 雇用契約、住所、家族、口座、通勤。
5. 社保、労保、税、入退社手続。
6. 書類依頼、upload、review、signed download、保存期限。
7. 手続case/step、期限、担当、エスカレーション。
8. Core Master変更申請と反映確認。
9. PII閲覧/更新監査。
10. 勤怠・評価・教育のsummary link。

## 使用する既存テーブル

| テーブル | 用途 | 方針 |
| --- | --- | --- |
| Core employees/stores/corporations | 基本情報 | read-only。専用承認API以外で更新しない |
| departments/positions/job_types | 組織・職種 | read-only |
| employee_assignment_histories | 配属履歴 | 504件を保護して利用 |
| employee_store_assignments | 店舗兼務 | 473件を保護して利用 |
| employee_roles | アプリ認可 | OS/Core所有。人事属性と混同しない |
| hr.employee_profiles | 人事private profile | 利用候補 |
| hr.employee_addresses | 住所 | 利用候補 |
| hr.employee_bank_accounts | 口座 | 利用候補 |
| hr.employee_commutes | 通勤 | 利用候補 |
| hr.employee_contracts | 契約 | 利用候補 |
| hr.employee_family_members | 家族 | 利用候補 |
| hr.employee_history | 雇用履歴 | assignment履歴との責任重複を確認 |
| hr.employee_social/labor_insurance | 保険 | 利用候補 |
| hr.employee_tax_profiles | 税 | 利用候補 |
| hr.employee_documents | 書類 | signed URL経由 |
| hr.audit_logs/change_logs | 監査 | 継続利用 |
| talent_employee_onboarding_* | 入社引継ぎ | 共有workflow |

## 新規テーブル候補

今回は作成しない。既存表で満たせない場合だけ次を比較検討する。

| 候補 | 用途 |
| --- | --- |
| employee_grade_histories | 等級履歴。positionへ混在させない |
| employee_employment_status_histories | 在籍/休職/復職/退職の時点履歴 |
| employee_change_requests | Core Masterへの変更申請と承認 |
| employee_onboarding_links | candidate/application/case/employeeの一意link |
| employee_data_access_logs | 高機密PIIの閲覧監査 |
| employee_consent_records | 個人情報利用同意とversion |

既存 `workforce_procedure_cases/steps/audit` が要件を満たすなら新しいcase tableは作らない。0件・lint errorのため採用前に構造と関数をレビューする。

## 画面一覧

| 画面 | MVP |
| --- | --- |
| 人事ダッシュボード（期限・未処理） | Yes |
| 社員一覧/検索 | Yes |
| 社員360概要（PII最小） | Yes |
| 配属・役職・等級履歴 | Yes |
| 入社受入case | Yes |
| 契約・労務情報 | Yes |
| 書類依頼/提出/review | Yes |
| 社保・労保・税手続 | Yes |
| 退職/休職/復職case | Yes |
| Core変更申請 | Yes |
| 権限/監査ログ | Admin |
| 人材評価詳細 | No |
| 教育コンテンツ | No |
| 勤怠打刻修正 | No |

## 権限

- self、manager、hr_operator、hr_admin、auditorを業務permissionとして定義候補にする。
- role名だけで許可せず、対象employee、法人scope、field sensitivity、actionを判定する。
- 口座、家族、税、保険、文書は通常社員一覧APIへ含めない。
- signed URLは短寿命、対象employee/document/bucket/pathをserver側で再検証する。
- Edge Functionへ渡す `p_actor_employee_id` を信用せず、認証tokenからserverが決定する。
- service_role使用時も同じ認可関数を通す。

## MVP範囲

### 含む

- 求人onboarding caseの受入とCore staff link。
- 社員ディレクトリ、配属/兼務/在籍履歴。
- 契約、住所、通勤、口座、必要書類。
- 入社、異動、休職、復職、退職case。
- Core変更申請、監査、HUB導線。

### 含まない

- 給与計算、年末調整計算、勤怠打刻、評価原本、LMS。
- Core Master物理変更。
- 全Legacy importの即時変換。
- AIによる人事評価・採否判断。

## 求人管理から引き継ぐ情報

| 引継ぐ | 引き継がない/再同意 |
| --- | --- |
| candidate/application/onboarding case ID | 選考メモ全文 |
| 氏名・かな・連絡先（本人同意済み） | 不採用者データ |
| 入社予定日 | フェアROI等の集計情報 |
| 予定法人/店舗/職種/雇用形態 | 採用担当の内部評価 |
| 内定日・承諾日 | 不要なセンシティブ情報 |
| 必要書類check状態 | 口座・家族・税（現職者側で取得） |
| sourceと同意version | 求人側のアクセス権 |

変換はidempotentにし、同じcaseから複数employeeを作れないようにする。辞退、入社延期、再応募、既存employeeへの再入社を状態遷移に含める。

## 勤怠・評価・教育との関係

| システム | 正本 | 現職者管理での扱い |
| --- | --- | --- |
| 勤怠 | 打刻、申請、確定勤怠 | 月次状態/例外summaryを参照。原本更新なし |
| シフト | 希望、作成、公開、確定 | 配属scope確認と参照link |
| 評価 | 評価項目、回答、確定評価 | 最新評価期・完了状態・権限制御linkのみ |
| 教育 | コース、受講、修了 | 必須教育の進捗summaryとlink |

人事イベントが他システムに影響する場合は、Coreの承認済み現在値を更新した後に各consumerが再読込する。現職者アプリから複数システムへ直接多重UPDATEしない。

## Legacy凍結

`web/hr-backoffice-dashboard` はDB未接続dummy previewであるため、現行本番アプリとして延命せず、画面要件と安全境界の参考資料としてFREEZEする。新アプリはこのコードをそのまま接続せず、実データ契約、RLS、Storage policy、監査を先に設計する。


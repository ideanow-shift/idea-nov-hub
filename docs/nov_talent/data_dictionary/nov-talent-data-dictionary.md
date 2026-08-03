# NOV Talent Data Dictionary

## 1. 文書管理

| 項目 | 正式値 |
|---|---|
| 文書ID | `NOV_TALENT_DATA_DICTIONARY` |
| Version | `1.3.0` |
| Status | `CANONICAL` |
| 適用日 | 2026-08-03 |
| 機械可読正本 | `nov-talent-data-dictionary.json` |

本書はNOV Talentで使用する正式名称、正式コード、正式定義の正本である。AI、CSV、UI、DB、Platformは、機械可読正本に存在するコードと定義だけを参照する。辞書にない値は推測・自動補完せず、処理を安全側で停止する。

対象は入社前のCandidateである。社員として入社した時点でEmployee Coreへライフサイクルを引き継ぎ、入社後はNOV Peopleが担当する。社員管理、評価、給与、異動、休職・復職、退職、勤怠、社員プロフィールはNOV Talentの対象外とする。

## 2. 共通ルール

- 正式コードは保存・連携・検証に使う。UIでは正式表示名を使い、内部コードを利用者向け文言として露出しない。
- 未知コードは受け付けない。辞書に定義がない項目は `FAIL_CLOSED` とする。
- 同じVersion内で既存コードの意味を変更しない。追加・廃止・意味変更は辞書Versionを更新する。
- 実氏名、連絡先、個別メモその他の個人値を辞書へ保存しない。
- 状態コードの並びから選考順序や自動遷移を推測しない。

## 3. 候補者状態

| 正式コード | 正式名称 | 正式定義 |
|---|---|---|
| `CONTACT` | 接点 | 候補者との接点を記録した状態。応募完了を意味しない。 |
| `LINE_REGISTERED` | LINE登録 | LINE登録を確認した状態。連絡先未取得の接点も許容する。 |
| `SALON_TOUR` | 見学 | 見学の実施を記録した状態。 |
| `INTERVIEW` | 面接 | 面接の実施または面接段階を記録した状態。 |
| `PASSED` | 承諾 | 現行Dashboardの承諾件数に使う候補者状態。イベントの `SELECTION_PASSED` とは別概念。 |
| `OFFER` | 内定 | 内定を提示または記録した状態。 |
| `EXPECTED_JOIN` | 入社予定 | 入社予定を確認した入社前状態。入社時にEmployee Coreへ引き継ぐ。 |
| `WITHDRAWN` | 辞退・保管 | 辞退し、採用活動の進行対象から外れた状態。物理削除ではない。 |
| `UNSET` | 未設定 | 候補者状態が確定していない表示用分類。保存用状態コードではない。 |

## 4. 学校

正式フィールドは `SCHOOL_NAME`（CSV列 `school_name`、アプリ項目 `school`）とする。学校名は閉じたEnumではなく文字列正本である。

- 最大180文字
- Unicode NFKC正規化、前後空白除去、空文字はnull
- 略称の自動展開、学校名の推測、仮名による穴埋めは禁止
- 正本で確認できない場合は空欄のまま確認対象にする
- 学校マスタの正式コード体系は現時点で未定義

## 5. イベント

| Metric Key | 正式イベントコード | 正式名称 | 定義 |
|---|---|---|---|
| `contacts` | `CONTACT_RECORDED` | 接点記録 | 候補者との接点を1件記録する。 |
| `lineRegistrations` | `LINE_REGISTERED` | LINE登録 | LINE登録確認を1件記録する。 |
| `salonTours` | `SALON_TOUR_COMPLETED` | 見学完了 | 見学完了を1件記録する。 |
| `interviews` | `INTERVIEW_COMPLETED` | 面接完了 | 面接完了を1件記録する。 |
| `passed` | `SELECTION_PASSED` | 選考通過 | 選考通過イベント。候補者状態 `PASSED`（承諾）とは同一視しない。 |
| `offers` | `OFFER_ISSUED` | 内定提示 | 内定提示を1件記録する。 |
| `expectedJoiners` | `EXPECTED_JOIN_CONFIRMED` | 入社予定確認 | 入社予定確認を1件記録する。 |

### 5.1 イベント失効理由

| 正式コード | 正式名称 | 定義 |
|---|---|---|
| `CANCELLED` | キャンセル | 予定された見学、面接または入社予定がキャンセルされた。 |
| `NO_SHOW` | 無断欠席 | 予定に連絡なく現れなかった。 |
| `DELETED` | 誤登録・削除 | 誤登録を集計対象から失効させる。監査記録の物理削除ではない。 |
| `WITHDRAWN` | 辞退 | 候補者が入社予定を辞退した。現行契約では入社予定イベントだけに使用できる。 |

利用可能な組合せは機械可読正本の `eventInvalidationAllowlist` を正とする。

## 6. 辞退理由・不採用理由

辞退を表す正式コードは現時点で `WITHDRAWN` のみである。辞退の詳細分類や自由記述理由をコード化する体系は未定義である。

不採用理由の正式コード体系は現行実装に存在しない。したがって、AI、CSV、UI、DBが独自の不採用理由コードを追加することは禁止する。正式な分類が必要になった場合は、辞書Versionを更新してから実装する。

## 7. 重複判定

| 正式コード | 正式名称 | 定義 |
|---|---|---|
| `SAME_PERSON` | 同一人物 | 総務人事部の人間確認により同一人物と判断した。 |
| `DIFFERENT_PERSON` | 別人 | 総務人事部の人間確認により別人と判断した。 |
| `HOLD` | 判断保留 | 追加確認まで判断を保留する。 |

氏名・学校、stable key、連絡先は一致候補を作るためのヒントであり、同一人物の確定根拠ではない。自動統合・自動削除は禁止し、人間確認を必須とする。

## 8. 件数定義

### 8.1 Dashboard

| 正式コード | 表示名 | 現行Mock Runtimeの算出基準 |
|---|---|---|
| `DASHBOARD_ENTRIES` | エントリー数 | `statusCode=CONTACT` の候補者数 |
| `DASHBOARD_SALON_TOURS` | 見学数 | `statusCode=SALON_TOUR` の候補者数 |
| `DASHBOARD_INTERVIEWS` | 面接数 | `statusCode=INTERVIEW` の候補者数 |
| `DASHBOARD_OFFERS` | 内定数 | `statusCode=OFFER` の候補者数 |
| `DASHBOARD_ACCEPTED` | 承諾数 | `statusCode=PASSED` の候補者数 |
| `DASHBOARD_EXPECTED_JOINERS` | 入社予定数 | `statusCode=EXPECTED_JOIN` の候補者数 |

この定義は現行匿名Mock Runtimeの定義であり、実データMigration件数の定義ではない。

### 8.2 Data Integrity

- Work Queue総数: 監査で起票されたIssue総数
- 修正済件数: 正本再監査または人間確認で終了したIssue数
- 残件数: `current_queue_included=true` の未終了Issue数
- Work Queue解消率: `修正済件数 ÷ Work Queue総数 × 100`
- 現在値: 17 / 17完了、残件0、解消率100%

### 8.3 Source件数と未確定事項

| 正式コード | 値 | 定義 |
|---|---:|---|
| `SOURCE_27_CONTACT_NUMBERED_ROWS` | 旧報告547／最新read-only観測541 | 27卒接触シートの採番済行数 |
| `SOURCE_27_CONTACT_POPULATED_ROWS` | 旧報告535／最新read-only観測528 | 正式なMigration対象行定義を満たす行数 |
| `SOURCE_27_CONTACT_COUNT_DIFFERENCE` | 旧報告12／最新read-only観測13 | 上記2基準の差。Data Consistency IssueでありData Integrity残件ではない。 |
| `SOURCE_28_CONTACT_ACTIVE_ROWS` | 108 | 28卒正式Sourceの現在の実データ行数 |
| `MOCK_CANDIDATE_TOTAL` | 147 | 匿名Mock候補者数（27卒27件、28卒120件） |

`OFFICIAL_27_CONTACT_MIGRATION_COUNT` の行判定基準はVersion 1.1.0で確定した。氏名、学校、電話番号、メール、LINE、イベント、ステータスのいずれか1項目以上が入力されている行をMigration対象とし、No.だけ採番されて上記7項目がすべて空のテンプレート行は対象外とする。null、空文字、空白文字だけの値は未入力として扱う。

最新read-only観測ではMigration対象528行、対象外の採番のみテンプレート13行である。旧547／535／12は過去の監査値であり、現在の正式件数として使用しない。

関連シートの最新read-only観測は、エントリー42行、内定35行、イベント36行である。氏名正規化による照合ヒントでは、接触528行に対して異なる氏名キーは520、エントリー側で接触と一致しないヒント10、内定側で接触と一致しないヒント8、内定側でエントリーと一致しないヒント1がある。これらは同一人物の確定結果ではなく、自動統合に使用しない。

## 9. Version

| 対象 | Version |
|---|---|
| Data Dictionary | `1.3.0` |
| Data Integrity Report schema | `1.2` |
| Work Queue seed schema | `2.0` |
| Source Lineage schema | `1.0` |
| CSV Safe Receipt schema | `talent-28-csv-safe-receipt-v1` |

## 10. Migration

| 項目 | 正式値 |
|---|---|
| Staging Status | `STAGING_SCHEMA_APPLY_PENDING` |
| Staging理由コード | `STAGING_CANDIDATE_VERSIONED_DATASET_SCHEMA_SOURCE_READY` |
| Production Status | `PRODUCTION_MIGRATION_HOLD` |
| Production理由コード | `STAGING_OPERATION_VALIDATION_AND_PROMOTION_APPROVAL_PENDING` |
| Data Integrity | 完了済み |
| Data Consistency | 確認中 |

Migration対象行の件数定義と5つのMigration・Staging運用契約は確定済みである。Stagingを運用検証環境として先行利用する。ProductionはStaging運用の受入確認と別昇格承認まで保留する。自動Migrationと自動昇格は禁止する。

### 10.1 確定済みMigration契約

- Candidate同一性契約: `candidate-identity-contract.json`
- Human Review証拠構造: `human-review-evidence.json`
- Migration先区分: `migration-target-mapping.json`
- Snapshot・受領・Rollback: 各Migration契約文書
- Staging先行運用: `staging-operations-contract.json`

### 10.2 Staging運用開始前の残件

| 優先 | 正式コード | 残件 |
|---:|---|---|
| 1 | `PRIVATE_READ_ONLY_DRY_RUN_AND_SNAPSHOT` | `RESOLVED`。正式Source 2件、636対象行、Quarantine 0件でdry-run PASSし、件数・HashだけのSnapshot候補を生成済み。 |
| 2 | `STAGING_OWNER_MIGRATION_AND_OPERATION_APPROVAL` | `RESOLVED`。Ownerが最新Snapshot、636 CandidateのStaging Migration、Migration照合後の運用開始を明示承認済み。 |
| 3 | `STAGING_CANDIDATE_VERSIONED_DATASET_SCHEMA_CONTRACT` | Candidate Versioned Dataset migration source実装済み。Remote Staging適用待ち。 |

### 10.3 Staging先行運用

- 正式Source: 27卒528件、28卒108件、合計636 Candidate
- 利用機能: Candidate管理、検索、Dashboard
- 正本: 正式Spreadsheet
- 更新経路: `Spreadsheet → read-only preflight → 承認済みImport → Staging`
- 初回書込み範囲: Candidate 636件のみ
- NOV Talent画面からのCandidate直接更新: 禁止
- Import方式: versioned snapshot replacement
- Production昇格: 別承認まで禁止

## 11. Platform Status・Release Status

現在のPlatform Statusは次の完全一致文字列とする。

`DATA_INTEGRITY_COMPLETED / STAGING_SCHEMA_APPLY_PENDING / PRODUCTION_MIGRATION_HOLD`

| コード | 正式名称 | 定義 |
|---|---|---|
| `DATA_INTEGRITY_COMPLETED` | Data Integrity完了 | Human Review Queue 17/17終了、Work Queue残件0。 |
| `STAGING_SCHEMA_APPLY_PENDING` | Staging Candidate schema適用待ち | Candidate 636件、28卒、Versioned Dataset、有効化、旧版復帰を満たすmigration sourceは実装済みで、Remote Stagingへの適用を待っている。 |
| `PRODUCTION_MIGRATION_HOLD` | Production Migration保留 | Staging運用検証とProduction昇格の別承認が完了するまで、Production書込みと自動昇格を禁止する。 |
| `RELEASE_READY` | Release Ready | Data Integrity Work Queue終了成果物を公開可能。Migration実行可を意味しない。 |

## 12. Role・Permission

既存Permission ModelのRole名だけを使用し、新Roleを追加しない。

| Roleコード | 正式名称 | Access Profile |
|---|---|---|
| `super_admin` | システム管理者 | `full` |
| `backoffice` | 総務人事部 | `full` |
| `hr.admin` | 総務人事部管理者 | `full` |
| `hr.staff` | 採用担当 | `recruiter` |
| `executive` | 代表取締役 | `executive` |

| Permission | full | recruiter | executive | denied |
|---|---:|---:|---:|---:|
| Dashboard閲覧 | 可 | 可 | 可 | 不可 |
| 候補者連絡先閲覧 | 可 | 可 | 不可 | 不可 |
| 非公開メモ閲覧 | 可 | 可 | 不可 | 不可 |
| 採用業務操作 | 可 | 可 | 不可 | 不可 |
| 管理設定 | 可 | 不可 | 不可 | 不可 |

## 13. Source

| 正式コード | 卒年 | 正本 | シート | 役割 |
|---|---:|---|---|---|
| `OFFICIAL_SOURCE_27_CONTACTS` | 2027 | 求人計画27卒_2025年9月～2026年8月 | 接触学生一覧（27卒） | `PRIMARY` / read-only audit |
| `OFFICIAL_SOURCE_28_CONTACTS` | 2028 | 求人計画28卒_2026年9月～2027年8月 | 接触学生一覧（28卒） | `PRIMARY` / read-only audit |
| `LEGACY_COPY_NON_CANONICAL` | - | 旧コピー | - | 正本利用禁止 |
| `ANONYMOUS_MOCK_RUNTIME` | - | 匿名Mock Runtime | - | Preview専用、Migration Sourceではない |

Spreadsheet ID・Sheet IDは機械可読正本に記録する。Source監査はread-onlyとし、辞書SprintからSpreadsheetを書き換えない。

## 14. Import

28卒CSVの正式Source Typeは `CONTACTS_28`、`ENTRIES_28`、`OFFERS_28` の3種類である。

正式列順:

`source_row_no, graduation_year, source_type, source_label, student_name, student_name_kana, school_name, faculty_or_department, phone, email, line_name, event_name, event_date, entry_status, selection_status, offer_status, next_action_date, follow_up_note, owner_note, stable_key_hint, mapping_hint, quarantine_flag, quarantine_reason`

主な契約:

- `graduation_year=2028`
- 本人識別最低条件は `student_name` と `school_name`
- 電話、メール、LINE表示名は任意の照合ヒント
- 日付は `YYYY-MM-DD`
- `quarantine_flag` は `TRUE` / `FALSE`
- `TRUE` の場合は `quarantine_reason` 必須
- ローカルpreflightのみ。network、DB書込み、raw値表示、retryは0
- production stagingとcanonical promotionはそれぞれ別承認
- 未知列・未知コード・契約不一致は安全停止

## 15. 禁止事項

- 辞書未定義コードの自動生成
- 学校名、氏名、理由の推測入力
- 重複候補の自動統合・自動削除
- CandidateからEmployeeへのデータコピー
- 未承認のStaging Migration
- ProductionへのMigration・書込み・自動昇格
- NOV Talentから正本Spreadsheetへの逆書込み
- 旧コピーを正式Sourceとして利用
- 辞書への個人情報またはSecretの保存

## 16. 参照開始ルール

今後のAIプロンプト、CSVテンプレート、UIラベル、DB制約、Platform Status、Import契約は、まず本辞書Versionを指定する。既存実装と辞書が矛盾した場合は自動的にどちらかへ合わせず、差異を不具合として報告し、辞書の変更承認または実装修正を行う。

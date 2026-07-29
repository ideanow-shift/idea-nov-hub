# Accounting Core Phase 3-2 最終報告

## 結論

**Conditional Go**: 隔離SQLite prototypeおよびレビュー用設計は合格。
**No-Go**: 本番migration、実会計データのpublish、consumer接続。

本番Supabase、DB、Storage、NOV HUB、IDEA LINKには接続・変更していない。

## 第11〜13期の取込・Validation

| 項目 | 第11期 | 第12期 | 第13期 |
|---|---:|---:|---:|
| sheet | 62 | 70 | 76 |
| entity候補 | 31 | 35 | 38 |
| raw value | 90,627 | 102,918 | 111,741 |
| accounting check | 3,162 | 3,570 | 3,876 |
| 式不一致 | 0 | 0 | 0 |
| 期間重複blocking | 8 | 11 | 42 |

同一adapterで3期を読み、会計式10,608/10,608件が一致した。A5の和暦年度
から期間を決定し、原本、金額、private口座名はGitへ保存していない。

期間重複61件の内訳はB/S非ゼロ同値11、P/L全ゼロ19、P/L非ゼロ同値31。
累計・決算列の混入0、adapter誤検出0。原因は61件すべて業務未確認なので
blockingを維持し、第13期7月はpublish不可。

## Version・二段階Approval・Publication

次の状態遷移を自動試験した。

`imported → validated → accounting_approved → management_approved → published`

- versionは不変UUID、連番、人間用labelを持つ
- 同期間再取込は新versionで、上書きしない
- Accounting Approvalだけではpublish不可
- Management ApprovalはAccounting Approval後のみ
- 両承認後も明示publishまでconsumerへ出ない
- accounting/management rejectionと理由・actor・日時をappend-only保存
- blocking、未承認／rejected mapping、未確定期間ではpublish不可

## Supersede・Rollback

Version Aをpublish後、Version Bを明示的にAの後継としてpublishし、Aを
superseded化した。rollbackはAを直接再公開せず、Aのlineageと値を参照する
新しい`rollback_restore` Version Cを作成し、二段階承認後にpublishする。

A/B/Cのfactはすべて保持され、published factのUPDATE/DELETEはSQLite trigger
で拒否された。consumerはrollback後にCのみを返した。

## Actor scope・Negative test

server-sideで解決した`ActorContext`のみを信用する。role、store、法人scopeを
request bodyから採用しない。

全自動テスト25件合格、うちsecurity/workflow negative test 15件合格:

- employeeの会計閲覧拒否
- store managerの他店閲覧・ID差替え拒否
- FC ownerの他FC・本部閲覧拒否
- clientのservice-role相当自己申告拒否
- unpublished consumer取得拒否
- 片側approval、blocking、mapping不備でのpublish拒否
- 第13期7月相当の期間重複publish拒否
- published factのUPDATE/DELETE拒否
- 他scope rollback拒否
- 重複file拒否
- 同一scope/periodの二重active publication拒否

## Consumer projection・Provenance

consumer viewはversion、publication、factがすべてpublishedの場合だけ返す。
試験ではpublish前0件、publish後1件、supersede後は新版のみ、rollback後は
rollback_restore版のみとなった。

fact IDからraw value、cell、sheet、file/hash、batch、fiscal year、versionへ
追跡できる。CLI provenanceは金額を表示しない。

## PostgreSQL／Supabaseレビュー用DDL・RLS

レビュー用SQLのみ作成し、末尾`ROLLBACK`で適用を防止した。

- 11 logical tables、FK、check、index、partial unique
- Core法人・店舗・部門UUID参照（master複製なし）
- 全table RLS enabled、policyなしdefault deny
- anon/authenticatedの直接権限revoke
- backend service role候補のみ
- published fact immutable、approval/audit append-only
- status audit trigger案
- published-only consumer view
- SECURITY DEFINERの固定search_path、専用NOLOGIN owner、advisory lock要件

## API契約

店舗営業管理:

- published・二段階承認済みのみ
- 売上、技術、商品、EC、粗利、営業利益、経常利益、累計
- 税込rule未承認は`null`かつ`preparing`

法人経営管理:

- 月次／累計P/L、B/S
- 粗利、営業利益、経常利益、税引前利益、当期利益
- 現預金、借入金、流動資産／負債、固定資産、純資産

共通でserver-side scope、version ID、period、last_published_at、data_stateを返す。
未取得値を0にしない。KPIは定義・可否のみで生成未実装。

## PDF突合

**Blocked**: 2026年1〜6月の指定PDFは未提供。

9項目のprivate CSV入力、差異額・率・原因候補・判定を出す比較ツールと
synthetic testは実装済み。PDFを正本にせず、結果を推測していない。

## 残存Blocking・Unknown

- 期間重複61sheetの業務原因
- 第13期7月の確定可否
- 38 entityのCore UUIDと年度別mapping承認
- account alias/dictionary承認
- 人件費、家賃、材料費、EC売上の正式定義
- 税区分、税率、端数rule
- 既存Core masterと`finance_*`実DDL
- 店舗責任者の利益閲覧範囲
- 本番職務分離設定
- PDF 3店舗×2か月突合
- OpenAPI専用validatorによる契約lint

## 本番移行可否・人間の確認

現時点の本番移行はNo-Go。経理が期間・account mappingを、管理者がentity
UUIDを、Security/DB ownerがDDL・RLS・職務分離を承認し、private PDF突合と
非本番PostgreSQL試験を完了する必要がある。

## 主な変更ファイル

- `accounting_core/`: domain、adapter、mapping、validation、workflow、scope、
  SQLite、projection、CLI、年度比較
- `tests/accounting_core/`: synthetic、workflow、negative、rollback、PDF試験
- `docs/accounting/accounting-core-phase3-multiyear-comparison.md`
- `docs/accounting/accounting-core-api-v1.yaml`
- `docs/accounting/accounting-core-versioning-adr.md`
- `docs/accounting/accounting-kpi-feasibility.md`
- `docs/accounting/pdf-reconciliation-procedure.md`
- `docs/accounting/yayoi-account-aliases.csv`
- `docs/accounting/yayoi-entity-effective-periods.csv`
- `supabase/migrations-proposed/accounting_core_phase3_review_only.sql`
- `tools/accounting/compare_yayoi_years.py`
- `tools/accounting/reconcile_store_pl.py`

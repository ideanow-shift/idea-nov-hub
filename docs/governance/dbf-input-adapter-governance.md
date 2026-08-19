# DBF Input Adapter Governance

- 経営データのWrite入口はDBFの1つだけとする。
- CSV、画面直接入力、将来のPOS/APIはInput Methodとして複数許可する。
- 各Input Adapterは既存DBF Normalized Row Contractへ変換する。
- Normalized Row以降のRaw、Mapping、Validation、Preview、Approval、Promotion、Auditは共通Pipelineを使用する。
- Manual専用Import API、Validation API、Promotion API、Fact Tableを作らない。
- ConsumerであるStore OperationsはRead-onlyとし、直接入力やBrowserからのDBアクセスを追加しない。
- Manual Draftはページ内Memoryだけに保持し、経営数値をlocalStorageへ保存しない。
- Manual Entryは監査用のdeterministic source artifactを生成し、既存のsource digest、raw row digest、batch lineageへ接続する。

`prepareDbfInput()` は `sourceType`、共通 `sourceSystem=dbf_phase_c_normalized_csv_v1`、`sourceArtifact`、`normalizedRows`、`mappingRequests` を返す。CSVは `csv_upload`、画面入力は `manual_entry` を使用する。

Backend Contract変更は0件。既存 `dbfImportMasterOptionsV1` と `dbfImportStartV1` 以降の共通Runtimeだけを利用する。

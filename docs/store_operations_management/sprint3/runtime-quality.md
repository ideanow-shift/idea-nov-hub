# Sprint 3 Runtime Quality

## 改善内容

- Logger / Diagnostics: 状態遷移、処理時間、再試行回数、エラーコードだけを最大50件保持する。社員ID、Token、JWT、Store IDは記録しない。
- Retry: 再試行不可状態では実行せず、連打時は同一Promiseを共有する。
- Timeout / Abort: 既存timeoutを維持し、再読込・adapter破棄時に進行中fetchをAbortする。古いレスポンスは反映しない。
- Error Mapping: timeout、offline、maintenance、validation error、forbidden、empty、unknownを別状態として表示する。
- Cache: Projection fetchは`cache: no-store`を維持する。画面内の絞り込み結果だけを参照同一性でmemo化する。

既存Runtime、API Contract、Permission Modelは変更していない。

# Sprint 2 Test Report

## 実施範囲

- Phase 2A〜2C: 実施
- Phase 2D: 正式Staging接続BLOCKED
- Phase 2E〜2F正式Staging UX: 停止条件により未実施

確認項目: Contract required/nullable/data_state/unknown、正式20店舗、13直営/7FC、Role scope、403とempty、利益5状態、Production block、read-only API、Sprint 1 UI静的回帰。

## 結果

- Sprint 2対象回帰: 155 / 155 PASS
- 基準全体テスト（Sprint 1 HEAD）: 431件中416 PASS / 15既知FAIL
- 変更後全体テスト: 435件中420 PASS / 15既知FAIL
- 新規失敗: 0
- JavaScript構文: PASS
- `git diff --check`: PASS

既知15件はSprint外のGAS廃止資料欠落およびManagement/Talent固定契約差異。正式Stagingブラウザ確認はPhase 2D停止条件により未実施。

# 緊急停止手順

## 停止トリガー

- Production identity不一致、想定外Query、timeout、lock、RLS異常、hash不一致、20/13/7不一致。
- 秘密情報・接続情報・個人情報・実UUID・実会計金額の露出または疑い。
- 未承認Snapshot、期限切れSnapshot、未承認のSandbox投入、権限逸脱。

## 即時操作

1. 実行中ならRunnerを正常終了させ、ROLLBACKとcloseを確認する。
2. Snapshotのactive pointerを無効化し、Sandbox APIを`unavailable`/`503`へfail-closeする。
3. 一時read-only Roleのログインを無効化し、資格情報共有を解除する。
4. 証跡には結果区分・時刻・hashのみを残す。秘密情報を複製しない。
5. OS責任者、DB責任者、代表へ通知し、原因と再開条件を記録する。

## 再開

再開には原因是正、露出時の資格情報ローテーション、影響評価、新しい抽出承認、新しい投入承認が必要である。自動復旧・自動再実行は禁止する。

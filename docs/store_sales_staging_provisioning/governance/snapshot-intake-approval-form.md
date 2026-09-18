# Snapshot投入承認書

## 原則

Snapshot取得成功はSandbox投入の承認ではない。本書による別承認の前に、アップロード・有効化・Function deploy・UI表示を行ってはならない。

## レビュー確認

- [ ] artifact hashとmanifest hashが一致する。
- [ ] manifestが未期限切れである。
- [ ] 店舗20、直営13、FC7が一致する。
- [ ] 所沢legacy crosswalkが有効である。
- [ ] confirmed-through periodとconfirmed状態が確認済みである。
- [ ] 未確定利益は`null`、FC利益は`unavailable`である。
- [ ] Q03-Q07は未承認のまま`unavailable`である。
- [ ] 個人情報、秘密情報、実UUID、実会計金額、接続情報の露出が0件である。
- [ ] rollback/close証跡を確認した。

## 判定

| 役割 | 承認 / 却下 / 要修正 | 日時 | 記録可能な備考 |
| --- | --- | --- | --- |
| Sandbox責任者 |  |  | hash・version・結果区分のみ |
| Core DB責任者 |  |  | hash・結果区分のみ |
| Accounting責任者 |  |  | confirmed periodのみ |
| 代表または委任承認者 |  |  |  |

却下時はSandboxをfail-closedのままとし、再投入は新しい承認を必要とする。

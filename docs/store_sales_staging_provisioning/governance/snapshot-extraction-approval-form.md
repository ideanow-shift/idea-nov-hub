# Snapshot取得承認書

## 承認対象

| 項目 | 記入内容 |
| --- | --- |
| 承認ID |  |
| 実行予定日時 |  |
| 実行者 | OS司令塔担当 |
| DB責任者 |  |
| 代表承認者 |  |
| Runner manifest hash |  |
| 実行Query | Q01 / Q02 / Q08のみ |
| 最大Query数 | 3 |
| retry | 0 |
| Snapshot version |  |

## 承認確認

- [ ] Production identityはprivate profileで全項目一致した。不一致時はQuery 0件で停止する。
- [ ] 期限付きread-only監査Roleは最小SELECT権限、同時接続1、BYPASSRLSなしである。
- [ ] 出力は固定49列のみで、禁止情報を含まない。
- [ ] `BEGIN READ ONLY`、5秒statement timeout、1秒lock timeout、ROLLBACK、closeを確認した。
- [ ] 抽出成功後もSandboxへ自動投入しない。

## 承認結果

| 役割 | 承認 / 却下 / 要修正 | 日時 | 備考（秘密情報禁止） |
| --- | --- | --- | --- |
| 代表 |  |  |  |
| OS責任者 |  |  |  |
| DB責任者 |  |  |  |

同一担当がOS責任者とDB責任者を兼ねる場合は、その事実と、技術確認・DB権限確認を別々に記録する。

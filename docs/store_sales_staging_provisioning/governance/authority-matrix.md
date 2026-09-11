# 権限マトリクス

| 操作 | 代表 | OS責任者 | DB責任者 | Accounting責任者 | Sandbox責任者 | 実行者 |
| --- | --- | --- | --- | --- | --- |
| 抽出方針承認 | Approve | Review | Review | Review | None | None |
| Production identity確認 | None | Review | Approve | None | None | None |
| read-only Roleの最小権限確認 | None | Review | Approve | None | None | None |
| 1回の抽出実行 | None | Observe | Observe | None | None | Execute |
| 証跡レビュー | Review | Approve | Approve | Review | None | None |
| Sandbox投入承認 | Approve or delegate | Review | Review | Review | Approve | None |
| Sandbox有効化 | None | Observe | None | None | Approve | Execute |
| 緊急停止 | Notify | Execute | Execute | Notify | Execute | Execute when directed |
| 年次監査 | Review | Review | Review | Review | Review | None |

`Execute`は単独承認権限を意味しない。Production抽出は代表・OS・DBの承認がそろった場合だけ実行できる。

# Data Contract Alignment

既存\`store-sales-projection-v1\`を変更しない。

| Contract領域 | 接続状況 |
|---|---|
| 売上 | 0項目接続、Source未確定 |
| 利益 | 0項目接続、確定値Source未確定 |
| 集客 | 0項目接続、Source未確定 |
| 単価 | 0項目接続、Source未確定 |
| 商品/MID | 0項目接続、Source未確定 |
| EC | 0項目接続、Source未確定 |
| 推移 | 0項目接続、履歴Source未確定 |
| 店舗一覧 | Synthetic contractのみ、Production未接続 |

欠損を0へ変換しない既存方針は維持する。正式接続時は\`collecting\`、\`preparing\`、\`unavailable\`、\`validation_error\`をSource状態に基づきserver側で返す。

Production adapterは現在\`PRODUCTION_NOT_APPROVED\`であり、遮断を解除していない。

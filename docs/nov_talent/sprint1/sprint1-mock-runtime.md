# Sprint 1 Mock Runtime

## 実行契約

`runtime-config.candidate.js` は `runtimeMode: mock`、`networkEnabled: false`、`writeEnabled: false` に固定する。接続URL、credential、Supabase設定を持たない。

## 状態

| 状態 | 表示目的 |
|---|---|
| loading | 読み込み中 |
| ready | 通常表示 |
| empty | 候補者0件 |
| unauthorized | 認証されていない |
| forbidden | 利用権限がない |
| validation_error | 入力・設定不整合 |
| timeout | 応答待ち超過 |
| offline | オフライン |
| maintenance | メンテナンス中 |

URLへ `?mockState=empty` のように付けると状態を切り替えられる。未定義値は `validation_error` として安全停止する。

すべての結果に通信0、retry 0を保持し、同じexecutorの二重実行を拒否する。

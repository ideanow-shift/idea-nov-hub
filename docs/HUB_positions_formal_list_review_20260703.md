# HUB positions正式リスト整理レビュー 2026-07-03

## 前提

OS/Core DB最終指示により、`public.positions` の正式役職候補は以下で固定する。

```text
相談役
会長
社長
副社長
取締役
執行役員
部長
課長
係長
エリアマネージャー
店長
店長見習い
副店長
FCオーナー
FCオーナー見習い
一般スタッフ
```

混同禁止:

```text
一般スタッフ = positions
レセプション = job_types
美容師 = job_types
カラーリスト = job_types
本部スタッフ = job_types
カラー専門店事業部 = departments
```

## SELECT preview結果

### 正式役職で存在済み

- 相談役: `0019`, active
- 会長: `0001`, active
- 社長: `0002`, active
- 副社長: `0003`, active
- 取締役: `0014`, active
- 執行役員: `0004`, active
- 部長: `0005`, active
- 課長: `0018`, active
- 係長: `0015`, active
- エリアマネージャー: `0006`, active
- 副店長: `0008`, active
- FCオーナー: `0013`, active

### 正式役職で不足

- 店長
- 店長見習い
- FCオーナー見習い
- 一般スタッフ

次番候補: `0020`

## positionsに残っている非正式active値

### 職種系として整理候補

| position_no | position_name | employee参照数 | 方針 |
| --- | --- | ---: | --- |
| 0010 | スタイリスト | 399 | `job_types` へ移行候補。すぐ無効化しない |
| 0011 | アシスタント | 1 | `job_types` へ移行候補。すぐ無効化しない |
| 0012 | 本部スタッフ | 3 | `job_types` へ移行候補。すぐ無効化しない |
| 0017 | レセプション | 0 | OS承認後、`is_active=false` 候補 |

### 役職として再確認が必要

| position_no | position_name | 方針 |
| --- | --- | --- |
| 0007 | SD | 正式リスト外。OS/Core DB確認が必要 |
| 0009 | チーフ | 正式リスト外。OS/Core DB確認が必要 |

## forbidden family label

- 会長夫人: `0016`, inactive, employee参照0
- 創業者夫人: 該当なし
- 夫人: 該当なし
- active forbidden family label件数: 0

## HUB画面/API確認

### master-admin画面

現状の役職選択肢は `state.masters.positions` を利用している。

```text
portal/master-admin/master-admin.js
fieldSelect("position_id", "役職", state.masters.positions, ..., "position_name")
```

現在の画面側フィルタ:

- `is_active=false` は非表示
- `会長夫人 / 創業者夫人 / 夫人` は非表示

未対応:

- 正式役職リスト外のactive positionsを画面から除外する制御は未実装
- そのため、現時点では `レセプション / アシスタント / スタイリスト / 本部スタッフ / SD / チーフ` がactiveであれば役職選択肢に出る可能性がある

### nov-hub-api

現在のAPI側ガード:

- `会長夫人 / 創業者夫人 / 夫人` は社員役職として保存不可

未対応:

- 正式役職リスト外のactive positionsを保存不可にするバリデーションは未実装
- `レセプション` など職種系positionsの保存拒否は未実装

## 次に必要な修正

DB更新はOS承認後に行う。

1. 正式役職不足分のINSERT案
   - `0020 店長`
   - `0021 店長見習い`
   - `0022 FCオーナー見習い`
   - `0023 一般スタッフ`
2. `レセプション` はemployee参照0のため、OS承認後 `is_active=false` 候補
3. `スタイリスト / アシスタント / 本部スタッフ` はemployee参照があるため、先に `employees.job_type_id` への移行候補を作る
4. `SD / チーフ` は正式役職に残すか、別軸へ移すかOS/Core DB確認が必要
5. master-admin画面は「正式役職 + 選択中の既存値」だけ出す制御が必要
6. nov-hub-apiは正式役職以外の保存を拒否する防御層が必要

## 実行禁止

このレビューでは以下を実行しない。

- INSERT
- UPDATE
- DELETE
- positionsの物理削除
- employeesの一括更新

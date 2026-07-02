# HUB positions正式追加・職種系positions移行レビュー 2026-07-03

## 前提

OS/Core DB指示により、以下をDB更新前レビューとして作成する。

- 不足positions 4件のSELECT preview
- not existsガード付きINSERT案
- `レセプション` position無効化案
- `スタイリスト` / `アシスタント` / `本部スタッフ` の `employees.job_type_id` 移行候補

このレビューではINSERT/UPDATE/DELETEを実行していない。

## 不足positions preview

現在の最大 `position_no`: `0019`

不足している正式役職:

| proposed position_no | position_name | 状態 |
| --- | --- | --- |
| 0020 | 店長 | 未登録 |
| 0021 | 店長見習い | 未登録 |
| 0022 | FCオーナー見習い | 未登録 |
| 0023 | 一般スタッフ | 未登録 |

INSERT案:

- `not exists` ガード付き
- `master_change_logs` に `employee_attribute.add_required_position` として記録
- `cleanup_id = employee_attribute_required_positions_20260703`
- `changed_by_email / executed_by = m.wakita@idea-nov.com`

## レセプション position無効化 preview

`レセプション` は `positions` ではなく `job_types`。

| position_no | position_name | id | is_active | employee参照数 |
| --- | --- | --- | --- | ---: |
| 0017 | レセプション | `799feda6-3263-4080-b133-458743fba752` | true | 0 |

OS承認後のUPDATE案:

- `where id = '799feda6-3263-4080-b133-458743fba752'`
- `and position_name = 'レセプション'`
- `and is_active = true`
- `and employees参照0件`
- `is_active=false`
- `master_change_logs` に `employee_attribute.deactivate_job_type_position` として記録

## 職種系positions 移行候補 summary

| position_no | position_name | employee参照数 | 推奨job_type | job_type未設定 | 既に推奨job_type | 別job_typeあり |
| --- | --- | ---: | --- | ---: | ---: | ---: |
| 0010 | スタイリスト | 399 | 美容師 | 389 | 0 | 10 |
| 0011 | アシスタント | 1 | 美容師 | 0 | 1 | 0 |
| 0012 | 本部スタッフ | 3 | 本部スタッフ | 3 | 0 | 0 |
| 0017 | レセプション | 0 | レセプション | 0 | 0 | 0 |

推奨job_type_id:

- 美容師: `1dd34eb8-67a6-4d51-a697-119212995c7e`
- レセプション: `201ffc51-b56d-400e-8e66-433654fef154`
- 本部スタッフ: `fac29177-226e-4146-899c-ff6a3a10e881`

## 移行方針

### すぐ無効化してよい候補

- `レセプション`
  - employee参照0件のため、OS承認後に `positions.is_active=false` でよい

### すぐ無効化しない候補

- `スタイリスト`
  - 399件の社員参照あり
  - 389件は `job_type_id` 未設定
  - 10件は別 `job_type_id` が入っているため、人事確認が必要
- `アシスタント`
  - 1件の社員参照あり
  - すでに `job_type = 美容師`
- `本部スタッフ`
  - 3件の社員参照あり
  - 3件とも `job_type_id` 未設定

## まだ実行しないこと

- 不足positionsのINSERT
- `レセプション` のUPDATE
- `スタイリスト` / `アシスタント` / `本部スタッフ` の無効化
- `employees.position_id` のNULL化
- `employees.job_type_id` の一括backfill

## 次の承認待ち

OS/Core DB側で以下を承認後に実行する。

1. `0020 店長` / `0021 店長見習い` / `0022 FCオーナー見習い` / `0023 一般スタッフ` のINSERT
2. `0017 レセプション` の `is_active=false`

職種系positionsの社員参照あり分は、別レビューで人事確認対象を分けてから進める。

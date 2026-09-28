# ADR-004 店舗売上の正本と締めルール

- Status: Blocked
- Date: 2026-07-28

## Context

複数のCSV/POS/帳票候補があり、正式source、税込/税抜、営業日、取消・返品、訂正規則が未承認。

## Proposed direction

一つの正式inputを選び、取引/明細/支払の粒度、source ID、digestを保持する。店舗日次/月次close後はimmutable snapshotをversion発行し、訂正は新versionにする。法人経営はsnapshotをread-only利用する。

## Blocker

営業・経理によるsourceとreconciliation基準の決定。

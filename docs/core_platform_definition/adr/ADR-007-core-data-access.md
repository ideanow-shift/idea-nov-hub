# ADR-007 Core Master参照・更新契約

- Status: Proposed
- Date: 2026-07-28

## Proposed decision

新WebアプリはCoreReadAdapter/APIからversion付きprojectionを参照し、物理表を直接参照しない。Core更新はCore ownerの承認済みcommand endpointだけ。店舗売上は確定snapshotで法人経営へ渡す。

## Consequences

public/core差分と将来移行を隔離できる。一方、adapterのSLO、cache/as-of、schema version、監査が共通基盤になる。View/RPC採用はライブGRANT/SECURITY DEFINER監査後に決める。

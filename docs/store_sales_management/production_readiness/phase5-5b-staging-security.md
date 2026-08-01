# Phase 5-5B Staging Security

## Controls

- review-only SQLはRLS enabled、anon/authenticated revoke、policyなしdefault deny、末尾ROLLBACK
- actor scopeをserver-side解決し、Store/FC/department越境とemployeeを拒否
- raw accounting、mapping、audit、provenanceをconsumerへ返さない
- frontend service role禁止
- SECURITY DEFINERは候補のみ。NOLOGIN owner＋固定search_pathが承認条件
- private Storageと短時間signed URLは計画のみ。Stage 1ではStorage不使用
- cacheはno-store。将来はactor/session/scope/version/periodで分離
- secretsは環境別登録。repositoryには値を保存しない

## Negative Tests

production fixture、cross environment、invalid issuer/signature/expiry、employee、Store/FC越境、token logging、RLS default deny、production page fixture混入を自動試験する。

## Remaining

Security Owner（代表取締役）review、正式RLS functions、secret rotation、signed URL TTL、rate limit閾値、Staging penetration review。

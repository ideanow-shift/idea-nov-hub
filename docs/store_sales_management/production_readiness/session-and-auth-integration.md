# Session and Auth Integration

## Purpose

NOV HUBからStore Salesへ、安全なcanonical sessionとserver-side actor contextを引き継ぐ。

## Current State

canonical client候補は`sessionToken`、`audience=nov_hub`、`expiresAt`。PreviewはsessionStorage、expiry、logout、401/403 clearを検証済み。正式refresh/API結合は未実装。

## Target State

1. NOV HUBが短寿命tokenを発行
2. `Authorization: Bearer`で同一originまたは許可originのProjectionへ送信
3. serverが署名、audience、expiry、revocationを検証
4. employee IDからDirectory role/assignmentを解決
5. actor scopeを生成しrequestのrole/scopeを破棄
6. Projectionがscope内データだけを返す
7. logout/expiry/role変更でsessionとcacheを失効

直接URLでも同じ検証を行い、HUBカード非表示だけに依存しない。

## Confirmed Decisions

tokenをURL、log、localStorage、PR、文書へ置かない。Runtimeはsession更新と401 clearを担うが、認可判断はserver-side。

## Proposed Decisions

refreshは1回だけ試行し、失敗時`unauthorized`。403は再loginでなく権限案内。CSRF/origin方式はdeployment方式決定後に確定。

## Unknowns

署名方式、issuer、audience詳細、TTL、revocation store、refresh endpoint、CORS、正式Directory role。

## Blocking Items

Staging identity、server verifier、revocation、logout E2E、direct URL negative test。

## Required Approvers

Platform Owner、Security Owner、Core Master Owner、CTO。

## Evidence／Source

- `portal/js/nov-hub-session-candidate.js`
- [Preview Security](../phase5/phase5-3-nov-hub-preview-security.md)
- [Role Scope Approval](role-scope-approval.md)

## Exit Criteria

login/logout/expiry/revocation/direct URL/role変更/越境UATが合格し、token非露出が確認される。

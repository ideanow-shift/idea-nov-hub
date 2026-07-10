# Decision Hub B1 actor confidence clean deploy candidate pack 2026-07-11

## Purpose

CoreOS selected Plan A first, Plan C as fallback, and rejected Plan B.

This pack fixes the next engineering path for making successful draft create usable without deploying unrelated dirty Edge changes.

## Current state

- `nov-hub-api/index.ts` worktree is currently clean.
- The current branch contains many committed `nov-hub-api` changes after the earlier Decision Hub read-only deploy.
- These include IDEA LINK, corporation management, notification preview/enqueue, and other HUB work.
- Therefore deploying current `HEAD` as-is would still be a broad Edge deploy, not a Decision-only deploy.

## CoreOS policy already received

```yaml
decision_hub_edge_candidate_policy:
  preferred: A
  fallback: C
  rejected: B
```

Interpretation:

- Plan A: restore deployed version 35 equivalent source, then apply only actor confidence hardening.
- Plan B: deploy current broad dirty/current Edge state. Rejected.
- Plan C: reconstruct clean source from previously approved H1-H8, then apply H9 actor confidence hardening.

## Actor confidence hardening target

The intended Decision Hub fix is limited to the PIN actor confidence path:

- `resolveDecisionActor(authUser, trustedEmployee)`
- PIN auth may use `trustedEmployee` only when server-side credential employee id matches.
- `authUser.credential.employee_id === trustedEmployee.id` is required.
- Both IDs must be UUID-shaped.
- `normalizeDecisionActor(trustedEmployee)` still enforces active/login-enabled checks.
- Firebase path keeps custom claim / uid actor path.
- No email fallback is added.
- Browser payload actor keys remain untrusted.

## Not part of this candidate

- IDEA LINK notification enqueue
- IDEA LINK notification preview
- corporation creation/update actions
- master admin layout or profile changes
- LINE WORKS notification changes
- any Secret hygiene change
- any broader Edge cleanup

## Required clean candidate checks

- Candidate source can be tied to deployed version 35 or documented reconstruction base.
- Diff from base contains only actor confidence hardening.
- `deno check supabase/functions/nov-hub-api/index.ts` passes.
- `git diff --check -- supabase/functions/nov-hub-api/index.ts` passes.
- Secret/token/service_role actual value scan passes.
- forbidden logging scan passes.
- RPC params unchanged.
- response sanitizer unchanged.
- `authType` remains transport metadata only.

## Deploy-before stop line

This pack is not deploy approval.

Still stopped:

- Edge deploy
- successful draft create retry
- B1 broader DML smoke
- DB direct RPC smoke
- UI live write connection
- RLS / GRANT change
- notification enqueue
- attachment / Storage
- Secret / service_role change
- role / employee_roles change
- portal_apps update
- os.notifications schema change
- rollback / drop

## CoreOS decision requested

Please confirm the next concrete path:

```yaml
decision_hub_b1_actor_confidence_clean_candidate:
  preferred_plan: A
  fallback_plan: C
  rejected_plan: B
  requested_next_step:
    - identify deployed version 35 equivalent source
    - or approve reconstruction base for Plan C
    - prepare actor-confidence-only candidate diff
  deploy_requested_now: false
```

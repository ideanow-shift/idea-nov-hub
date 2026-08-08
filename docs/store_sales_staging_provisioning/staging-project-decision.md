# Staging Project Decision

## Decision

**Decision pending options comparison.**

There is no ACTIVE Supabase project with owner-approved Staging identity evidence. This blocks selection today, but does not prove a new project is the only viable option. The active Core project and inactive sandbox project must be compared under the evidence and isolation criteria in [staging-project-options-comparison.md](staging-project-options-comparison.md).

## Required characteristics for any selected option

1. an approved Staging environment label and identity profile;
2. a separate project reference, API URL, database, and Edge Function deployment target from Production;
3. a private identity profile that records only fingerprints/masked reference, region, owner, and approval date;
4. a deployment owner and rollback artifact owner;
5. a project-level no-Production-routing check before any secret or function deployment.

## Decision owner

Platform Owner and Security Owner jointly select the option. Core DB, Accounting, and Sales owners attest that their staging read-only sources are non-Production. Project creation or sandbox reactivation remains a separately approved human action.

## Stop condition

Any target whose identity cannot be proven Staging remains rejected before secret registration, function deployment, or E2E.

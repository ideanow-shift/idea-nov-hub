# Staging Project Decision

## Decision

**New Staging project required.**

There is no ACTIVE Supabase project with owner-approved Staging identity evidence. Selecting the active Core project or the inactive sandbox project would be an assumption and violates the sprint boundary.

## Required project characteristics

1. a new project name and environment label containing `staging`;
2. a separate project reference, API URL, database, and Edge Function deployment target from Production;
3. a private identity profile that records only fingerprints/masked reference, region, owner, and approval date;
4. a deployment owner and rollback artifact owner;
5. a project-level no-Production-routing check before any secret or function deployment.

## Decision owner

Platform Owner and Security Owner jointly select or create the project. Core DB, Accounting, and Sales owners attest that their staging read-only sources are non-Production.

## Stop condition

Any target whose identity cannot be proven Staging remains rejected before secret registration, function deployment, or E2E.

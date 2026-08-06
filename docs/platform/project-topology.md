# Project Topology

## Decision

IDEA NOV Platform uses two Supabase projects: `idea-nov-core` for Production and `idea-nov-staging` for shared Staging. This is a topology decision only; no project rename, configuration change, migration, deploy, or Production access is included.

## Boundary

| Layer | Production: idea-nov-core | Shared Staging: idea-nov-staging |
| --- | --- | --- |
| Purpose | approved live operation | non-production integration, security, migration, and release rehearsal |
| Data | production-approved data only | synthetic, masked, or separately approved non-production data only |
| Auth | production issuer, audience, origin | staging-specific issuer, audience, origin; no production token acceptance |
| Database | production schema and migrations | staging schema and migrations; no cross-project DB access |
| Functions / Storage / secrets | production-only resources | staging-only resources |
| Deployment | separately approved production pipeline | protected staging deployment pipeline |

## Shared Staging Domains

Core Business Data Foundation, Store Operations, Finance, Management Platform, and Digital Signage may share the Staging project when each domain has a declared schema ownership boundary, function namespace, storage prefix/bucket ownership, dataset classification, migration owner, and access review. Existing Production NOV HUB and NOV Talent operations remain unchanged. Shared project does not mean shared authorization.

## When Another Project Is Required

Create an additional project only when a domain requires hard isolation that a shared project cannot provide: a separate administrator set for secrets, a distinct compliance/data residency boundary, incompatible release cadence that cannot use the shared migration window, a separate authentication trust boundary, or an independently billable/owned product. Feature count alone is not a reason.

## Evidence Limit

This review relies on repository environment contracts and the prior Sandbox inventory handoff. It does not attest the current remote project configuration. Before operation begins, the Staging owner must reconfirm project identity, functions, schemas, secrets, auth configuration, storage, RLS, and GitHub environment protection without exposing values.

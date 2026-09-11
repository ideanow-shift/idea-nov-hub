# Staging Project Options Comparison

## Scope and decision boundary

No project was created, reactivated, linked, connected to, or modified for this comparison. The two currently known projects are represented only by masked management metadata:

- ACTIVE Core project: environment classification is not proven;
- INACTIVE sandbox project: no approved Staging identity, runtime readiness, or ownership evidence exists.

The comparison does not assume either project is Production, Staging, or safe to reuse.

## Options

| Option | Description | Current status |
| --- | --- | --- |
| A. New Staging project | dedicated non-Production project for Store Sales and future pre-production integrations | available only after human creation/approval |
| B1. Existing ACTIVE Core project | logical separation by environment, role, secret, deployment target, and data boundary inside the active project | prohibited until its environment is proven non-Production and isolated |
| B2. Existing INACTIVE sandbox project | reactivate and harden the sandbox as a dedicated Staging target | candidate only after ownership, lifecycle, baseline, and isolation review |

## Comparison

| Dimension | A. New Staging project | B1. Existing ACTIVE Core project | B2. Existing INACTIVE sandbox project |
| --- | --- | --- | --- |
| Structure | physical project/database/function separation | logical separation only; same project boundary | physical project separation after reactivation |
| Cost | one additional project and operational baseline | lowest direct cost | lower than new project if existing capacity is acceptable |
| Operations | separate deploy, observability, backups, and runbooks | fewer consoles, but harder environment discipline | requires rehabilitation runbook before use |
| Secret management | isolated Staging secret namespace; simplest deny-by-default | highest accidental cross-environment secret risk | isolated namespace after old secrets are revoked and replaced |
| Security | smallest blast radius; no shared database/function target | unacceptable unless non-Production proof plus strict technical isolation exists | acceptable only after inactive project provenance and access review |
| Rollback | disable Staging endpoint without affecting Core target | rollback can affect unrelated Core workloads if boundaries are wrong | restore to disabled/inactive state; retain a versioned artifact |
| Future People / Finance | can host shared Staging contracts with domain-specific ports, or be split later | shared Core coupling grows; any scope error has wider impact | can become a shared Staging integration project after governance approval |
| Time to first E2E | slower because project provisioning is required | fastest only if proven non-Production and all separation controls already exist | medium; reactivation and hardening required |
| Evidence gap today | owner approval and creation | environment identity, workload ownership, data isolation, deploy impact | ownership, lifecycle, data baseline, secret rotation, deploy readiness |

## Security comparison

### Existing ACTIVE Core project

Environment names, GitHub Environment names, or an active status do not prove that an existing project is safe for Staging. Reuse is allowed for consideration only when all of the following are independently attested:

1. the project is not Production and has no Production route, data, secret, or function target;
2. Store Sales data is a Staging-only replica or approved non-Production data set;
3. Store Master and Accounting ports are separate least-privilege read-only identities;
4. deploy, observability, rollback, and secrets are limited to a protected `store-sales-staging` Environment;
5. a failed function cannot reach Production by URL, credential, connection string, linked project, or fallback.

Without all five, B1 is a hard NO-GO.

### Existing INACTIVE sandbox project

Sandbox reuse avoids new project cost but is not automatically safe. It requires a pre-activation review: project owner, former workload inventory, secret revocation receipt, database/object baseline, RLS posture, stale function inventory, and rollback-to-disabled plan. No historical sandbox data may be assumed suitable for Store Master or Accounting data.

## Recommendation

**Decision pending human evidence.**

The preferred order is:

1. B2, reuse the existing sandbox only if the pre-activation review proves a clean, owned, non-Production boundary;
2. A, create a dedicated Staging project if B2 cannot meet the security baseline;
3. B1 is not recommended unless the ACTIVE Core project is explicitly attested non-Production and all five isolation controls are proven.

This ordering limits cost without accepting an unverified shared-project risk. It does not authorize reactivation, secret registration, or deployment.

## Human decision required

Platform Owner, Security Owner, Core DB Owner, Accounting Owner, and CTO select exactly one option after reviewing the evidence list above. Until then, Store Sales remains source-ready but not connected.

# Outcome 3 — Recruiting Intelligence Contract v1.0.0

Phase 1 is a read-only, server-aggregated API at `GET /api/talent/v1/recruiting-intelligence`. It does not change Workspace Contract 1.0.0, Outcome 1/2 commands, flags, transactions, database schema, or the hosted Talent UI.

## Official source boundaries

- Current position: Candidate Selection Projection only.
- Funnel: unique Candidates with each exact official Selection History fact. Earlier stages are never inferred and rates remain unpublished in v1.
- Communication: effective `COMMUNICATION_RECORDED` rows after correction replacement.
- Workflow: active Next Action rows and canonical Employee identifiers.
- School: active School Master identity by `school_id`; Candidate school text is not a join key.
- Fair result: `CONFIRMED ORIGIN` attribution joined to official Selection History. PENDING is excluded and reported only under management diagnostics.
- Targets: `UNSET` until an approved canonical target source exists.

## Priority contract

Each nonterminal Candidate appears in at most one, highest-priority bucket: overdue OPEN action; due today; awaiting reply with overdue/missing OPEN action; a follow-up-requiring Selection fact without OPEN action; unassigned OPEN/ON_HOLD action; stalled Candidate. Terminal codes are `OFFER_ACCEPTED`, `WITHDRAWN`, and `REJECTED`; `OFFERED` is nonterminal.

Stalled means seven or more days since the latest effective Communication, official Selection fact, or formal Next Action activity, with no future OPEN Next Action. Sorting is deterministic by deadline (null last), oldest latest official activity, then Candidate ID.

## Availability and privacy

Every source has explicit availability. A dependent section becomes `PREPARING` with nullable metrics/empty detail instead of a false zero. The response does not contain phone, email, LINE identifier, notes, communication content, source evidence, audit payloads, actor identity, or tokens. Authentication, role/profile resolution, and scope enforcement use the existing HUB server-side boundary.

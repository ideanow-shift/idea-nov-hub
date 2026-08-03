# Environment Policy

## Environment Classes

| Class | Allowed | Prohibited |
| --- | --- | --- |
| Local / fixture | unit tests, synthetic fixtures, parser rehearsals | Production identifiers, credentials, live data |
| idea-nov-staging | integration tests, approved migrations, protected staging functions, masked/synthetic data | Production endpoint, credential, token, direct database path, unapproved data copy |
| idea-nov-core | separately approved live operations | test fixtures, staging credentials, automatic promotion from a branch |

## Configuration Rules

- Resolve environment only from trusted deployment configuration; never from UI query parameters, local storage, or a browser role claim.
- Maintain separate URLs, auth issuer/audience, redirect origins, storage resources, secrets, monitoring sinks, and audit retention for Production and Staging.
- Browser code receives no secret/service credential. Server-side code receives only the minimum Staging secret required for its approved function.
- Staging secrets must not be copies of Production secrets. Rotation and revocation are domain-owned and recorded without values.

## Approval Rules

GitHub Environment `store-sales-staging` remains protected by an explicit human approval. Equivalent protected environments are required before NOV Talent, Finance, or HUB deploys to the shared Staging project. No automatic Staging-to-Production promotion is permitted.

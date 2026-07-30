# Permission Model to RLS Mapping

## Architecture mapping

RLS is the final database enforcement layer, not the place where the browser
constructs business authority. A future policy maps a server-validated
permission decision into a row predicate and a permitted operation.

| Permission layer | RLS responsibility | Must not rely on |
| --- | --- | --- |
| Employee | Bind authenticated subject to active employee state | Client-provided employee reference |
| Role | Confirm active server-side role assignment | UI role label |
| Organization | Confirm approved organizational responsibility | Department text field alone |
| Store Scope | Constrain rows to resolved approved store target | Hard-coded client store list |
| Data Scope | Select only tables/views/projections in approved domain | Generic schema access |
| Action Scope | Separate SELECT, INSERT, UPDATE, DELETE and approval mutation rules | Read permission as a write grant |

## Policy architecture rules

- Policies must be target-specific and action-specific.
- RLS should consume stable server-side or database-resolved facts rather than
  unsafely parsing broad JWT contents.
- Sensitive domains use minimum projections, not a broad table policy followed
  by client-side filtering.
- Service-role infrastructure may bypass RLS only inside a reviewed server
  boundary that independently evaluates this model; it must not proxy a
  browser-supplied scope.
- Default deny remains in place when an organization, store, data, action, or
  effective-date fact is unavailable.

No SQL, policy, grant, or RLS configuration is created by this architecture.

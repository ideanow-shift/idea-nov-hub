# 04. RLS Policy Remediation

## Current source evidence

Several newer Core tables enable RLS and then grant only `service_role`:
`public.store_business_profiles`, `public.corporation_business_profiles`, and
`public.job_types`. Existing source does not provide a committed PostgREST
`auth.uid()` to employee mapping or a canonical department-to-store relation.
The proposed policy therefore defaults to denial whenever identity/scope
evidence is absent.

## Policy matrix for `store_operation_history`

| Persona | Read | Create/update | Constraint |
| --- | --- | --- | --- |
| Representative | all stores | yes | role key `representative` or `super_admin` |
| Executive | all stores | yes | role key `executive` |
| Department | denied pending approved department-store membership | denied | no inferred store access |
| Store Manager | assigned store only | denied | active role scope type `store` |
| FC Owner | corporation-scoped stores only | denied | active role scope type `corporation` |
| Employee | own active primary store only | denied | `employees.store_id` equals target |

The SQL has three policies: one select policy covering the six personas, and
separate insert/update policies for Representative and Executive. It provides
no delete policy. `service_role` is unchanged and remains outside ordinary RLS
policy evaluation.

## Deployment prerequisites

1. Staging validates that Firebase/Edge identity is represented in
   `public.employees.firebase_uid` for the JWT `sub` claim.
2. Entity Approval confirms the `representative` role-key mapping; current
   committed role seed lists `super_admin` but not `representative`.
3. Department access remains disabled until an approved department-to-store
   relation is introduced.
4. Execute role and scope fixtures under a non-service database role; never
   treat service-role success as RLS validation.

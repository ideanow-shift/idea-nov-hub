# NOV HUB Employee Position / Assignment Canonical Corrective

Status: source/design/local-fixture candidate. Production execution is not authorized.

## 1. Current canonical structure

The operational master currently lives in `public.*`:

- `public.employees` stores one `corporation_id`, `department_id`, `store_id`, `position_id` and `job_type_id`.
- `public.positions` is a single-label master referenced by `employees.position_id`.
- `public.employee_store_assignments` is the effective-dated SSoT for store membership/scope. Its assignment type means primary/secondary/support/temporary membership, not title responsibility.
- `public.employee_assignment_histories` is append-oriented assignment history and is not a current multi-assignment SSoT.
- `public.employee_roles` and `public.roles` are authorization SSoT. They must not be replaced by display titles.

The newer BDF `core.*` model is a staging snapshot/version layer. It contains effective-dated store assignments but does not yet provide corporate positions or department/corporation responsibility assignments. It does not replace the operational `public.*` master.

Authoritative source evidence:

- `portal/master-admin/master-admin.js:1410,3791`: one Position selector.
- `portal/js/hub-context.js:330-331`: one Position ID/name in browser display context.
- `supabase/functions/nov-hub-api/index.ts:2465,3764,3798`: one Position read/write/history field.
- `supabase/core-employee-store-assignments.sql:1-20`: effective store membership contract.
- `supabase/core-assignment-histories.sql:29-76`: append/history contract.
- `supabase/migrations/20260806090918_m005_bdf_employee_store_assignments.sql:25-81`: BDF store-only assignment versions.
- `docs/architecture/14_pr001_core_master_migration_design_package.md:178-202,567-592`: staging and Store Scope ownership boundary.

## 2. Root cause

One `employees.position_id` currently carries two different concepts:

1. corporate office: chair, president, director, executive officer;
2. organization responsibility: department head, section head, area manager, store manager.

Master Admin, HUB Context and `nov-hub-api` therefore expose exactly one title. The model cannot represent one corporate office plus one or more concurrent responsibilities.

## 3. Recommended model

### Position

Keep one corporate position per employee during this corrective. Existing `public.positions` and `employees.position_id` remain available for compatibility. The recommended additive path is a nullable `positions.position_class` discriminator so the existing master remains authoritative while mixed legacy labels can be separated without deleting rows. Backfilling that discriminator is a separate reviewed DML gate. A replacement Position registry is unnecessary unless the Core DB owner requires effective-dated Position master versions.

### Assignment

Add an effective-dated organization responsibility model:

- `organization_assignment_types`: stable code, display name, allowed target type and active flag.
- `employee_organization_assignments`: employee, assignment type, exactly one target organization, effective interval, active, primary, priority and source.

Multiple active assignments are allowed. Updating an assignment ends the old interval and appends a new state; it does not overwrite history. Store membership remains in `employee_store_assignments` and is not overloaded with title responsibility.

### Display projection

The backend derives a display-only title at an `as_of` date:

`corporate position + active organization assignments`

Example: `執行役員 兼 営業部長`.

Authorization continues to resolve employee, role/permission, organization/store scope and effective dates on the backend. Display labels never grant access.

## 4. Classification of the current 17 labels

| Current label | Canonical class | Migration treatment |
| --- | --- | --- |
| 未設定 | null state | Do not create a master row. |
| 会長 | Position | Corporate position candidate. |
| 社長 | Position | Corporate position candidate. |
| 副社長 | Position | Corporate position candidate. |
| 執行役員 | Position | Corporate position candidate. |
| 部長 | Assignment | Department responsibility. Target department is required. |
| エリアマネージャー | Assignment | Store group/business-unit responsibility. Exact target model requires owner confirmation. |
| 副店長 | Assignment | Store responsibility. |
| FCオーナー | Assignment | Store/corporation operating responsibility, not corporate office. |
| 取締役 | Position | Corporate position candidate. |
| 係長 | Assignment | Department/team responsibility. Exact target type requires owner confirmation. |
| 課長 | Assignment | Department responsibility. |
| 相談役 | Position | Corporate position candidate. |
| 店長 | Assignment | Store responsibility. |
| 店長見習い | Assignment | Store responsibility/training state. Owner must confirm whether this is a responsibility or development status. |
| FCオーナー見習い | Assignment | Store/corporation responsibility/training state; human review required. |
| 一般スタッフ | Human review | Not a corporate Position. Prefer absence of elevated responsibility plus `job_type`; use a `staff` assignment only when a target organization is explicitly known. |

No assignment is generated from a label alone when its target cannot be proven.

## 5. Consumer impact

| Consumer | Current dependency | Corrective path |
| --- | --- | --- |
| NOV HUB / Master Admin | one `position_id`, one department and one store | Add Position and repeatable Assignment UI; retain legacy fields during transition. |
| `nov-hub-api` | validates/formats one position and appends assignment history | Add canonical read/write actions later; keep existing employee actions unchanged initially. |
| HUB Context | one position object/name | Keep the field as compatibility display hint; do not add assignment authority to browser context. |
| Store Operations | authorization roles plus effective store assignments | Keep current authorization. Resolve department-head responsibility from the new assignment SSoT only after enablement. |
| NOV Talent | role-based access and employee display metadata | Continue current contract; adopt display projection only where a title is shown. |
| Management | role/scope backend checks, some employee display metadata | Adopt projection incrementally; no role inference from title. |
| IDEA LINK / Decision | roleKeys and backend authorization | No authorization change. Optional display migration only. |
| CSV/export | one legacy position column | Preserve it. Introduce separate canonical position and assignment import contracts in a later gate. |

## 6. Backward compatibility

1. Add canonical assignment tables without deleting or renaming legacy fields.
2. Read canonical Position/Assignment when available.
3. Fall back to legacy `position_name` when no canonical record exists.
4. Keep old API response keys and add a versioned `titleProjection` envelope later.
5. Move consumers one at a time.
6. Consider legacy field retirement only after repository-wide read/write count reaches zero and Production evidence confirms it.

The local helper in `review/hub-position-assignment-corrective-20260811` demonstrates this projection and fallback without runtime wiring.

## 7. Migration plan

### Gate A: source and Production metadata evidence

- Confirm current Production columns, constraints, indexes, RLS, policies and grants using the sealed read-only audit runner.
- Confirm that assignment type names/codes and target organization types have accountable owners.
- Confirm whether `btree_gist` is already available before proposing overlap exclusion constraints.

### Gate B: additive schema

- Add a nullable classification discriminator to the existing Position master; do not classify rows in the schema gate.
- Create assignment type and employee organization assignment relations.
- Enable RLS and keep browser roles at zero direct access.
- Add backend-only read/write boundaries in a separate grant/RPC/API gate.
- Do not seed, backfill or modify employees/positions in this gate.

### Gate C: compatibility projection

- Add read-only backend projection at explicit `as_of`.
- Preserve legacy response fields.
- Verify existing consumers and authorization regression.

### Gate D: reviewed data migration

- Auto-classify labels only into migration queues; classification itself does not mutate data.
- Auto-create a record only when employee, target organization, assignment code and effective date are all uniquely proven.
- Send ambiguous cases to Human Review.
- Never infer multiple assignments solely from one legacy title.

### Gate E: UI and writers

- Add atomic assignment actions and change history.
- Enable Master Admin editor after backend and authorization review.
- Move consumers incrementally.

Rollback of an additive deployment disables new reads/writes and returns consumers to legacy projection. It does not delete canonical records automatically.

## 8. Master Admin UI

Replace the visible role block with:

- `基本役位`: one corporate Position selector.
- `所属・役割`: repeatable rows showing target type/name, responsibility, effective dates and primary state.
- `+所属・役割を追加`.
- Explicit `終了` action that closes an interval; no destructive delete.

Current department/store fields remain visible as compatibility membership during Phase 1. They must not independently write duplicate assignment facts. Assignment save is a separate backend operation, not mixed into the existing employee save until an atomic contract is approved.

## 9. Acceptance case

No Production row is changed by this pack. The acceptance fixture represents the named case as:

- Position: `執行役員`
- Assignment target: `営業部`
- Assignment type: `部長`
- State: active for the requested `as_of` date
- Display: `執行役員 兼 営業部長`

Store Operations can later resolve the current Sales Department Head by assignment code, department identity and effective interval. It must not use employee name or approximate title matching.

## 10. Open owner decisions

- Final operational table names and whether Position gets a new versioned registry.
- Assignment code dictionary and target type for area/section/training responsibilities.
- Primary semantics when multiple target types are active.
- Overlap rule and extension availability.
- RLS/policy/grant and audited write contract.
- Human Review workflow and effective-date source.

## Readiness

`CANONICAL POSITION / ASSIGNMENT CORRECTIVE READY: YES`

This means the source/design/local-fixture corrective is ready for owner review. Production migration, data correction, backfill, runtime wiring, Store Operations snapshot and legacy retirement remain explicitly unapproved.

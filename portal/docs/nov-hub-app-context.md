# NOV HUB App Context v1

## Purpose

NOV HUB passes a non-secret employee context to internal apps such as IDEA LINK.

This context is for display, routing, and permission hints only. Apps that write sensitive data must still call a server-side endpoint or Supabase RLS-protected API.

## Source

- Auth: Firebase Auth through NOV HUB
- Employee master: Supabase Core DB `public.employees`
- Store master: Supabase Core DB `public.stores`
- Roles: Supabase Core DB `public.employee_roles` and `public.roles`

## Storage

NOV HUB stores the current employee context in browser `sessionStorage` and mirrors it to `localStorage` for cross-tab app launches.

The context expires after 12 hours.

Key:

```text
novHub.currentEmployee
```

Helper:

```html
<script type="module" src="https://ideanow-shift.github.io/idea-nov-hub/js/hub-context.js"></script>
```

Usage:

```js
const context = window.NovHubContext.read();
```

## Context Shape

```js
{
  schema: "nov-hub-context",
  schemaVersion: 1,
  source: "supabase",
  sourceLabel: "Core DB",
  authType: "firebase",
  id: "employee uuid",
  coreEmployeeId: "employee uuid",
  supabaseEmployeeId: "employee uuid",
  staffId: "employee uuid",
  employeeId: "employee uuid",
  employeeNumber: "1",
  name: "脇田 将樹",
  email: "m.wakita@idea-nov.com",
  authEmail: "m.wakita@idea-nov.com",
  corporation: { id: "corporation uuid", code: "IDEA_NOV", name: "IDEA NOV" },
  corporationId: "corporation uuid",
  corporationName: "IDEA NOV",
  department: { id: "department uuid", code: "HR", name: "総務人事部" },
  departmentId: "department uuid",
  departmentName: "総務人事部",
  position: { id: "position uuid", name: "社長" },
  positionId: "position uuid",
  positionName: "社長",
  primaryStore: { id: "store uuid", storeNo: "0000", storeId: "honbu", name: "本部" },
  primaryStoreId: "store uuid",
  primaryStoreNo: "0000",
  primaryStoreCode: "honbu",
  primaryStoreName: "本部",
  storeCode: "honbu",
  store: "本部",
  employmentStatus: "現職",
  employmentType: "代表取締役",
  roleLevel: 5,
  roleKeys: ["executive"],
  tags: ["all", "executive", "hq"],
  storedAt: "2026-06-24T00:00:00.000Z",
  issuedAt: "2026-06-24T00:00:00.000Z",
  expiresAt: "2026-06-24T12:00:00.000Z"
}
```

Important ID rules:

- `employeeId`, `coreEmployeeId`, `supabaseEmployeeId`, and `staffId` all mean Supabase Core DB `employees.id`.
- `employeeNumber` means the human employee number from `employees.employee_id`.
- New apps should store `supabaseEmployeeId` / `employees.id` as foreign keys, not employee names.

## Security Rules

- Do not store `service_role` in front-end code.
- Do not store Firebase ID tokens in `sessionStorage` for child apps.
- Treat `novHub.currentEmployee` as a convenience context, not a security boundary.
- Server-side writes must verify the actor again through GAS, Edge Functions, or Supabase RLS.
- Personal information should be fetched only when the user role requires it.

## IDEA LINK Migration Use

Phase 1:

- Continue current GAS + Spreadsheet test operation for Tachikawa and Tokorozawa.
- Read employee and store identity from NOV HUB context where available.
- Keep Thanks posting and LINE WORKS notification on the existing GAS path.

Phase 2:

- Read staff and stores from Supabase Core DB.
- Map IDEA LINK `staff_id` to Core DB `employees.id`.
- Map IDEA LINK `store_id` to Core DB `stores.id` or `stores.store_id`.

Phase 3:

- Move Thanks posts to an IDEA LINK-specific Supabase table.
- Move LINE WORKS store notification channels to Supabase.
- Keep notification sending server-side.

## Recommended App Guard

```js
const context = window.NovHubContext.read();

if (!context || !context.id) {
  location.href = "https://ideanow-shift.github.io/idea-nov-hub/";
}
```

For app-side compatibility, prefer:

```js
const actorId = context.supabaseEmployeeId || context.employeeId;
const actorEmail = context.authEmail || context.email;
```

## Permission Hints

Use `roleKeys` and `tags` for UI visibility:

- `super_admin`: full system admin
- `executive`: executive view
- `department_manager`: department manager
- `area_manager`: area manager
- `store_manager`: store manager
- `staff`: general staff
- `fc_owner`: FC owner
- `trainer`: education/trainer
- `backoffice`: HR/general affairs
- `accounting`: accounting

Do not rely on these hints alone for database writes.

# Store Scope Matrix

## Server-side scope rule

Store scope is resolved from an authenticated HUB session on the server. The browser may request a period or allowed detail store ID but may not enlarge scope through URL, body, local storage, or UI state.

| Product role | Default scope | Effective store set | AM / owner prerequisite |
| --- | --- | --- | --- |
| Representative / Executive | all current stores | Direct 13 + FC 7 | none |
| Sales manager | direct stores | Direct 13 | none |
| Area manager | assigned stores | approved effective-dated AM assignments only | **currently blocked: no approved assignment source** |
| Store manager | self | server-resolved own active store | current employee-store assignment required |
| FC owner | assigned FC stores | server-resolved FC operator/store relation | effective operator relation required |
| Other roles | none | empty set | no access |

## AM assignment contract (not populated)

| Required field | Rule |
| --- | --- |
| `employee_uuid` | server-resolved identity; never browser-supplied |
| `store_uuid` | proposed canonical public UUID only after owner approval |
| `effective_from` / `effective_to` | no overlapping active assignment for the same AM/store relation without human decision |
| `assignment_source` | approved HR/Sales authority only |
| `approved_by` / `approved_at` | required before scope is active |

No AM name or guessed assignment appears in this package. Until a source is approved, `area_manager` receives an empty store set and the API returns a fixed unavailable/forbidden state rather than a broader scope.

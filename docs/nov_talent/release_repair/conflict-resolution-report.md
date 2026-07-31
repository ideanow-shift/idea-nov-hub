# Conflict resolution report

The old PR merge-tree reported six conflicting files. Applying only the two effective commits to current main removed textual conflicts and produced the following semantic resolutions.

| file_path | main side | PR side | Adopted resolution | Other-app impact |
| --- | --- | --- | --- | --- |
| `portal/talent/app.mjs` | Current staff UI and shared behavior | Candidate Mock workspace and Sprint 2 view models | Preserve current shared code; add scoped Mock Candidate behavior | None; no shared app routing changed |
| `portal/talent/csv-import-preflight.mjs` | Latest compatible 28-year CSV validation | Cache/import wiring | Preserve main validator and only retain compatible Talent wiring | No DB or Store change |
| `portal/talent/index.html` | Latest operator labels and repairs | Candidate-only shell and decision areas | Preserve main markup, add Candidate Mock regions, freeze workforce navigation | NOV People remains separate |
| `portal/talent/style.css` | Current responsive and readability fixes | Sprint 1/2 scoped styles | Preserve main CSS and append scoped Talent rules | No global stylesheet change |
| `tests/nov-talent-csv-import-preflight.test.mjs` | Current compatibility fixtures | Release cache assertion | Keep fixtures; update only the clean release identifier | No runtime behavior change |
| `tests/talent-ui-hierarchy.test.mjs` | Current navigation/mobile expectations | Candidate-only separation assertions | Retain current hierarchy and add NOV People separation checks | Existing HUB and Store navigation retained |

Resolution principles were current main first, NOV Talent-only additions, no new authentication system, no employee management, and no duplicated shared files.

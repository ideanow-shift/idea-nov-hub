# Store Operations Staging Authentication Test Matrix

| ID | Case | Expected |
|---|---|---|
| AUTH-01 | Independent Magic Link/Auth route or onboarding action | absent |
| AUTH-02 | No NOV HUB session | unauthorized, fail closed |
| AUTH-03 | Browser employee/Role spoof | ignored and rejected |
| AUTH-04 | Browser scope/Store UUID expansion | `SCOPE_DENIED` |
| AUTH-05 | Access/refresh token in query, fragment, HTML, log, or referrer | zero |
| AUTH-06 | Browser private AUTH-01/Core/M019 RPC execution | denied |
| AUTH-07 | Browser service-role exposure | zero |
| HANDOFF-01 | Existing DBF handoff used for Store Operations | denied; target contract mismatch |
| HANDOFF-02 | Existing IDEA LINK handoff used for Store Operations | denied; audience/path mismatch |
| HANDOFF-03 | Approved Store Operations handoff unavailable | hosted UI remains fail closed |
| ROLE-01 | 脇田 Executive server contract | exactly 20 official stores; HQ excluded |
| ROLE-02 | 戸田 Area Manager server contract | active effective assigned stores only |
| ROLE-03 | 桝本 Store Manager server contract | 上石神井店 only |
| DATA-01 | Missing monthly metric | `preparing`, never zero |
| DATA-02 | TOTAL_SALES and MID_SALES | no MID addition to TOTAL_SALES |
| DATA-03 | Response inspection | raw Store UUID zero |
| WRITE-01 | Store Operations request suite | Business write 0; DBF Canonical write 0 |
| ENV-01 | Production project or endpoint | rejected; Production change 0 |

Browser Hosted UAT cannot be marked PASS until the formal NOV HUB application-session handoff exists and the normal user login path is exercised.

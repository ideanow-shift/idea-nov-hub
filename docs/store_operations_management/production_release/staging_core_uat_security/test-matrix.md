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
| HANDOFF-03 | Store Operations code lifetime | at most 60 seconds |
| HANDOFF-04 | First valid server-side exchange | short-lived Store Operations audience session issued |
| HANDOFF-05 | Second exchange of the same code | rejected atomically |
| HANDOFF-06 | Wrong origin, audience, state, nonce, expired code, or expired source session | rejected |
| HANDOFF-07 | Browser calls exchange without BFF boundary proof | rejected |
| HANDOFF-08 | Application session transport | Secure HttpOnly SameSite cookie; token absent from browser response |
| OIDC-01 | Valid Google RS256 token, issuer, exact audience, time and authorized service account | accepted |
| OIDC-02 | Missing token, invalid signature, wrong audience or expired token | `401` |
| OIDC-03 | Valid Google token for another service account or subject | `403` |
| OIDC-04 | Valid OIDC with absent/wrong defense secret | fail closed |
| PKCE-01 | `/auth/start` | signed HttpOnly state/verifier cookie; S256 challenge only |
| PKCE-02 | Correct verifier | exchange succeeds |
| PKCE-03 | Missing/wrong verifier, state or method | rejected |
| ROLE-01 | 脇田 Executive server contract | exactly 20 official stores; HQ excluded |
| ROLE-02 | 戸田 Area Manager server contract | active effective assigned stores only |
| ROLE-03 | 桝本 Store Manager server contract | 上石神井店 only |
| DATA-01 | Missing monthly metric | `preparing`, never zero |
| DATA-02 | TOTAL_SALES and MID_SALES | no MID addition to TOTAL_SALES |
| DATA-03 | Response inspection | raw Store UUID zero |
| WRITE-01 | Store Operations request suite | Business write 0; DBF Canonical write 0 |
| ENV-01 | Production project or endpoint | rejected; Production change 0 |

Browser Hosted UAT cannot be marked PASS until the reviewed migration and runtime are deployed to Staging and the normal NOV HUB login/launch path is exercised. 戸田 and 桝本 remain `DEFERRED_UNTIL_NORMAL_NOV_HUB_LOGIN` until their normal NOV HUB accounts are available.

# Store Operations Staging Core UAT Security Test Matrix

| ID | Case | Expected |
|---|---|---|
| POP-01 | Valid sealed artifact dry-run | 6 corporations, 20 stores, 3 users; writes 0 |
| POP-02 | Re-run identical artifact | no-op; duplicate 0 |
| POP-03 | HQ, extra employee, synthetic row, changed digest, or wrong project | entire run rejected |
| POP-04 | Apply interruption | atomic rollback; partial commit 0 |
| AUTH-01 | Admin-created user then native OTP with `shouldCreateUser:false` | native Staging subject; shared password 0 |
| AUTH-02 | Unknown Auth subject | unauthorized |
| AUTH-03 | Auth subject/Employee mismatch or duplicate active binding | unauthorized |
| AUTH-04 | Inactive binding, identity, employee, or Auth user | unauthorized |
| AUTH-05 | Expired/inactive assignment | forbidden |
| AUTH-06 | Client Role/employee spoof | ignored and rejected |
| AUTH-07 | Client scope/Store UUID expansion | `SCOPE_DENIED` |
| AUTH-08 | OTP replay, expired session, wrong audience/project | unauthorized |
| ROLE-01 | 脇田 Executive | exactly 20 official stores; HQ excluded |
| ROLE-02 | 戸田 Area Manager | active effective assigned stores only |
| ROLE-03 | 桝本 Store Manager | 上石神井店 only |
| DATA-01 | Missing monthly metric | `preparing`, never zero |
| DATA-02 | TOTAL_SALES and MID_SALES | no MID addition to TOTAL_SALES |
| DATA-03 | Response/log inspection | raw UUID, email, token, secret 0 |
| ACL-01 | Browser direct binding/M019/Core execution | denied |
| ACL-02 | Browser bundle inspection | service role exposure 0 |
| WRITE-01 | Store Operations request suite | Business write 0; DBF Canonical write 0 |
| ENV-01 | Production project or credential | rejected before mutation |
| REVOKE-01 | Session/Auth/binding/Role/M019 revoke | subsequent access denied |

Implementation acceptance requires every row PASS, existing Store Operations regression PASS, `git diff --check` PASS, security/performance advisors reviewed, and Hosted Role Smoke PASS.

# Hosted Smoke Plan

Use existing Production identities selected by the Owner. Do not create, modify or reveal identities in evidence.

1. NOV HUB card opens Store Operations without a second login.
2. Executive sees exactly 20 active operating stores: 13 direct and 7 FC.
3. Area Manager sees only active, in-term `employee_store_assignments` stores.
4. Store Manager sees only the own store.
5. Requests attempting role, employee, store UUID or `scopeMode=all` expansion are rejected.
6. Missing facts and missing fiscal-year definitions render `準備中`; no missing value becomes zero.
7. Synthetic/fixture values and fake priority actions are absent.
8. Browser payloads contain no raw store UUID.
9. Store Operations write count remains zero and Production Business Data write count remains zero.
10. Console error/warning count is zero and Dashboard, Store List and Store Detail remain usable with partial data.

Candidate inventory can be selected without exposing personal data: Production currently has eligible Executive, Area Manager and Store Manager accounts, including active Area Manager assignments. Owner selects the actual accounts; this package changes no role.

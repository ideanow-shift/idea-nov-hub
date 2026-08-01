# Platform Status Dashboard

The dashboard source is [portal/platform-status](../../portal/platform-status). It is the common progress record for 求人管理, 店舗営業管理, HUB, Core DB, Accounting, People, and Finance.

## Update rule

For every status update, edit `portal/platform-status/status-data.mjs` in the same change as the evidence that supports it. Do not set `PASS` based on code completion alone. A domain may display `RELEASE_READY` only when data integrity, workflow, UI/UX, operational review, and development quality are all `PASS`.

Every edit must include: a non-sensitive evidence reference, owner, current status, next decision, updated date, `node review/platform-status-dashboard.test.mjs`, and `git diff --check`.

`UNVERIFIED` means that no sufficient evidence has been recorded. It is not a negative claim about the underlying system.

# HUB integration clean report

- Branch: `release/nov-talent-v2-hub-integration-clean`
- Working base: `release/nov-talent-v2-clean-base`
- Source: the single effective commit `4d378da` from old PR #12
- Expected delta: 13 files, approximately one commit
- HUB label: 求人管理
- Description: 候補者・選考・イベント・次回対応を管理
- NOV People: hidden or preparation-only; its functions are not returned to NOV Talent
- Access: existing Permission Model names only
- Guards: unauthenticated return-to-HUB, expired-session screen, unauthorized 403
- Privacy: representative role receives summary-only restrictions; HR leadership and recruiting mappings use existing roles
- Production Mock Identity: rejected by guard contract
- Effective delta: one commit; 13 HUB/Talent integration files plus 3 release-repair report updates and 1 main-contract test alignment (17 files total)
- Fixed regression: 219/219 PASS, 0 new failures
- Local browser integration:
  - HR leadership: HUB card visible, NOV Talent opens without a second login
  - Representative director: dashboard access allowed; contact fields, private notes and Mock write controls hidden
  - Ordinary staff: HUB card hidden and direct URL returns 403
  - Missing or expired session: Auth Guard shown with a NOV HUB return link
  - Browser console: 0 errors and 0 warnings in the authorized launch flow

The final branch is validated after the clean release branch and does not contain a second copy of the Talent body changes.

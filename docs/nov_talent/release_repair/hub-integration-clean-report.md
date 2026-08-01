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

The final branch is validated after the clean release branch and must not contain a second copy of the Talent body changes.

# Recommended Merge Strategy

## Recommendation: Option A

1. Create the Dashboard V1.1 PR: head `feature/store-operations-v1-1-ux-polish`, base `main`.
2. Create the HUB integration as a stacked PR: head `feature/store-operations-v1-hub-launch-integration`, base `feature/store-operations-v1-1-ux-polish`.
3. Move the Dashboard V1.1 PR to Ready for Review and merge it first after approval.
4. After V1.1 is on `main`, change the HUB PR base to `main` and confirm that the PR contains only `c953c63` and 17 files.
5. Re-run the 236 Store Operations tests and the full suite before merging the HUB PR.

Use a normal merge commit for V1.1 if repository policy allows it; this preserves ancestry and automatically reduces the HUB PR to one commit. If policy requires squash merge, create a fresh branch from updated `main` and cherry-pick only `c953c63`; do not force-rebase the reviewed branch without re-review.

## Why not Option B

The HUB branch could be one integrated PR, but it would expose 33 commits and 278 files and erase the separate V1.1 review boundary. It is safe in content but unnecessarily broad. The V1.1 PR would become a close candidate only if humans intentionally select this option.

## Why not Option C

A new implementation integration branch is unnecessary because the current branches are a strict, conflict-free stack. Selective commit reconstruction increases the chance of omitting earlier Store Operations foundations. The only justified fresh branch is the squash-merge recovery described above.

## Human GitHub operations

- Confirm repository `ideanow-shift/idea-nov-hub` and that both remote branches are visible.
- Create or locate both Draft PRs using the base/head pairs above.
- Set only the V1.1 PR to Ready for Review first.
- Do not set the HUB PR Ready until V1.1 is merged and its base/diff is reduced to one commit and 17 files.
- Do not close either PR during audit. If Option A is used, no PR needs closing.
- If Option B is deliberately chosen, the V1.1 PR is the only close candidate, and only after the integrated PR is approved.

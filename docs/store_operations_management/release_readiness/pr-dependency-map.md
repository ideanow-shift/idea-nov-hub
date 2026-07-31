# PR Dependency Map

Audit date: 2026-08-01

```text
origin/main
24486d8
  └─ 32 commits / 269 changed files
     Dashboard V1.1
     5a4ab99 feat(store-sales): polish executive decision UX
       └─ 1 commit / 17 changed files
          HUB launch integration
          c953c63 feat(store-sales): integrate NOV HUB launch
```

`git merge-base --is-ancestor 5a4ab99 c953c63` passed. Both feature branches have `24486d8` as their merge base with `origin/main`, and `origin/main` is an ancestor of both. The HUB branch therefore contains the complete Dashboard V1.1 history and tree.

## Overlap when both PRs target main concurrently

| Measure | Dashboard V1.1 | HUB integration | Overlap |
|---|---:|---:|---:|
| commits after main | 32 | 33 | 32 |
| changed files | 269 | 278 | 269 |

The only non-overlapping HUB delta is `c953c63`, containing 17 files. Concurrent PRs against `main` would duplicate the complete V1.1 review surface. This is a review duplication, not a content conflict.

## GitHub state

The connected GitHub search returned no PR for either branch or commit. No PR was closed or modified during this audit. The reported existing Draft PR could not be confirmed on GitHub and must be created or its repository/account visibility confirmed by a human.

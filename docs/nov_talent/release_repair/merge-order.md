# Merge order

1. Review and merge PR A: `release/nov-talent-v2-clean-base` into `main`.
2. Confirm the main workflow is green and no Pages regression is visible.
3. Change PR B base from `release/nov-talent-v2-clean-base` to `main`.
4. Confirm PR B now shows only the HUB launch integration delta.
5. Re-run required checks, then review and merge PR B.

Do not merge PR B first. Do not merge old PR #11 or #12. Leave them open until the replacement PRs are accepted; then a human may close them with links to the replacements.

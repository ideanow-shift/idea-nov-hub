# State Machine

`uploaded -> validating -> imported -> reviewing -> published`

Validation failure transitions to `validation_failed`. A same-period publication supersedes the older `published` version. A completed two-person rollback marks the selected version `rolled_back` and restores the latest eligible `superseded` version. Invalid transitions are rejected.

`validating` is retained as the required validated-and-awaiting-import state. No version is visible to Store Operations before `published`.

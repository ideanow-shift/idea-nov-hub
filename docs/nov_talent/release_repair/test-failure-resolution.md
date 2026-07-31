# Test failure resolution

The blocked audit reported 13 new failures. On the reconstructed PR A branch, 12 were reproducible; the thirteenth belonged to the old PR #12 shared HUB/Store delta. PR A initially ran 195 tests with 16 failures, including four failures already present on main.

| Category | Count | Resolution |
| --- | ---: | --- |
| Old write-enabled expectations | 8 | Updated to the approved Mock-only, request-zero contract |
| Old cache/path expectations | 3 | Replaced exact historical hashes with the clean release identity or semantic route checks |
| Workspace fixture/shape expectation | 1 | Assert the anonymous 147-candidate repository contract |
| Old HUB/Store shared delta | 1 | Excluded from PR A; PR B is rebuilt from one effective HUB commit and retains Store regression coverage |
| Unrelated known main failures | 4 | Repaired by the same formal Mock-only expectations; not skipped |

No test was deleted or skipped. Final PR A local result: 195 passed, 0 failed.

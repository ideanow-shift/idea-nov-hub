# Version and Publication Model

## Immutable Version Rule

Each same-period re-import creates a new immutable version. It does not overwrite a prior import, fact, validation result, or audit event.

```text
uploaded -> dry_run_validated -> imported -> reviewing -> published -> superseded
                         \-> validation_failed
published -> rollback_requested -> rolled_back / restored_by_new_publication
```

The names above are a lifecycle contract, not a confirmed database enum.

## Publication Selection

- Store Operations reads only the latest compatible `published` version for the selected source profile and target period.
- A later publication supersedes the prior published version through an append-only event.
- `preparing` is an internal state; the user-facing label is `集計中`.
- `not_published`, `validation_failed`, and `unavailable` do not become zero-valued business metrics.

| Internal state | User display | Projection behavior |
|---|---|---|
| `preparing` | 集計中 | No amount returned. |
| `not_published` | 未公開 | No amount returned. |
| `validation_failed` | 取込エラー | No amount returned. |
| `unavailable` | 利用不可 | No amount returned. |
| `published` | Published value | Only allowed source facts are projected. |

## Rollback

Rollback requires Accounting and Representative approvals recorded independently. It appends an audit and publication decision, then selects a previous eligible immutable version. Deletion, update-in-place, and automatic rollback are prohibited.

## Open Physical Decisions

Catalog evidence must decide whether existing `accounting_versions`, `accounting_publications`, and `accounting_approvals` can hold these states and links. No new table or column is selected by this document.

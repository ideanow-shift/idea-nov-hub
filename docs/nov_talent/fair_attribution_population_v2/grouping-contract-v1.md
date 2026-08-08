# Fair Attribution Grouping Contract v1

`logical_candidate_count` is the number of distinct Candidate IDs. A physical pending row is one distinct Candidate-Fair pair. Each Candidate is classified from its current candidate Fair count: one is `single_candidate_case`; two or more is `multiple_candidate_case`.

The runner must derive all five reported values from the same grouped Candidate-Fair set and fail closed when either grouping invariant fails. It does not use historical `unique case` wording or pre-filled counts as an input.

The v1 Manifest remains `LEGACY / HASH CONTRACT UNRECOVERABLE`. It supplies historical row-to-Candidate/Fair evidence only after that evidence has been revalidated against the current ACTIVE Candidate Dataset and active Fair Master.

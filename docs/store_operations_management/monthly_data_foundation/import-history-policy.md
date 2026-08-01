# Import History Policy

The future import history records only operational metadata necessary for
traceability: batch ID, version, CSV type, target period, source file name and
hash, accepted/rejected row counts, state transitions, actor employee number,
approval reference, and timestamps.

It must not retain customer rows, employee personal attributes, credentials,
connection details, raw accounting journals, or unmasked UUID inventories.

History is append-only at the policy level. Corrections create a subsequent version
with an explicit reason; they do not erase the fact that a prior version existed.
Retention duration and approver identity handling require a separate governance
decision before implementation.

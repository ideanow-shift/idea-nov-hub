# Department to Store Mapping Human Questions

Each question needs an accountable business owner decision before a mapping can
be implemented. A missing response means default deny.

| question_id | target | confirmation needed | recommended candidate | impact | blocking_flag |
| --- | --- | --- | --- | --- | --- |
| Q01 | Sales / 営業部 | Is Sales responsible for direct stores only or all stores including FC? | Direct 13 stores pending FC decision | Sales scope | true |
| Q02 | FC Business / FC事業部 | Is FC a formal department, or a function under another approved department? Who owns FC scope? | Formalize the entity before any FC-wide mapping | FC scope and entity model | true |
| Q03 | Education / 教育部 | Does Education require all 20 stores or only direct stores, and which education metrics are permitted? | All 20 education KPIs only; no finance profit | Education data scope | true |
| Q04 | EC / EC事業部 | Is EC a non-store entity scope, or does it require store visibility? | No store scope; separate EC business aggregate | EC data model | true |
| Q05 | HR / 総務人事部 | Is HR authorized by employee scope rather than store scope, and which aggregates are allowed? | No store scope; separately governed personnel aggregate | HR data classification | true |
| Q06 | Accounting / 経理部 | Does Accounting require all 20 stores for read-only financial analysis, and which financial classes are permitted? | All 20 read-only financial aggregates | Finance data scope | true |
| Q07 | Store baseline | What authoritative source confirms the 13 direct / 7 FC membership, corporate association, and effective date? | Approved roster with owner and effective date | Every department candidate | true |
| Q08 | Governance | Which data-scope and action-scope classes are approved, and who approves future changes? | Read-only first; default deny for actions and unclassified data | Resolver, RLS, and API design | true |

## Decision protocol

Each response must name the accountable owner category, approved scope outcome,
effective date, permitted data classes, and permitted action classes. It must
not identify individual employees or use a role title as a replacement for a
department decision. Contradictory answers keep the related scope unavailable.

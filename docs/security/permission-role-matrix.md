# Permission Role Matrix

All entries are architecture candidates, not activated grants. The role matrix
is evaluated with organization, store, data, and action matrices. `PENDING`
means no effective permission until the required human decisions are approved.

| role | organization context | candidate store scope | candidate data domains | maximum candidate action | approval status |
| --- | --- | --- | --- | --- | --- |
| Representative Director / 代表取締役 | Enterprise | All 20 stores | Sales, profit, PL, BS, KPI, education, HR, recruiting, EC, attendance, shift, tasks, thanks | Admin pending domain exclusions | PENDING |
| Director / 取締役 | Enterprise | All 20 stores | Sales, profit, PL, BS, KPI, education, HR aggregate, recruiting aggregate, EC, attendance aggregate, shift aggregate, tasks, thanks | Approve pending sensitive-data rules | PENDING |
| Executive Officer / 執行役員 | Enterprise or approved business unit | All 20 stores pending mandate | Sales, profit, PL, BS, KPI, education, HR aggregate, recruiting aggregate, EC, attendance aggregate, shift aggregate, tasks, thanks | Approve pending mandate | PENDING |
| Sales Head / 営業部長 | Sales Department | Direct 13 stores pending FC decision | Sales, KPI, tasks, thanks | Approve pending sales governance | PENDING |
| Education Head / 教育部長 | Education Department | All 20 stores pending education owner | Education, KPI, tasks, thanks | Approve pending education governance | PENDING |
| EC Head / EC事業部長 | EC Department | None pending EC entity decision | EC, KPI, tasks, thanks | Approve pending EC governance | PENDING |
| HR Head / 総務人事部長 | HR Department | None pending employee-scope decision | HR, recruiting, attendance, shift, tasks, thanks | Approve pending HR privacy rules | PENDING |
| Accounting Head / 経理部長 | Accounting Department | All 20 stores pending accounting owner | Sales, profit, PL, BS, KPI, tasks, thanks | Approve pending finance governance | PENDING |
| Area Manager / エリアマネージャー | Approved store group | Assigned stores only | Sales, KPI, education, tasks, thanks | Update pending operational policy | PENDING |
| Store Manager / 店長 | Assigned store | Assigned store only | Sales, KPI, education, attendance, shift, tasks, thanks | Update pending operational policy | PENDING |
| FC Owner / FCオーナー | Approved FC corporation | FC stores of approved corporation | Sales, KPI, education, attendance, shift, tasks, thanks | Update pending FC contract | PENDING |
| Employee / 一般社員 | Assigned department and store | Assigned store or none | Education, attendance self, shift self, tasks, thanks | Update self-or-assigned work only pending policy | PENDING |

## Constraints

- No row assigns a department-wide store entitlement by itself.
- HR, recruiting, attendance, and shift use additional privacy and employment
  policy checks; aggregate and individual access must be distinct.
- Export, Delete, and Admin are never implied by a displayed maximum action.
- A person holding multiple roles receives the union of independently approved
  grants, never a union of unapproved candidates.

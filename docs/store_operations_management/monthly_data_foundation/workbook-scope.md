# Yayoi Workbook Scope for Store Operations V1

## Selection boundary

The Yayoi `残高試算表（年間推移）` workbook is a container. Store Operations V1
does not adopt its full sheet inventory as a design boundary. It reads only the
approved selected P/L sheets defined in the versioned Sheet Mapping Contract.

The historical repository audit found a 76-sheet reference workbook (38 P/L and 38
B/S). That count is layout evidence only. It is not an import requirement, a
mapping-row requirement, or an assertion about the next workbook.

## Allowed content

| Item | Rule |
| --- | --- |
| Sheet | mapped Direct-13, FC-7, and explicitly approved headquarters/EC P/L only |
| Account | approved P/L metric or supporting validation account only |
| Column | actual monthly activity column that resolves to `YYYY-MM` |
| Tax basis | tax-excluded only |
| Context | statement type, account section, target period, mapping version, and source hash |

## Rejected or ignored content

| Item | Handling |
| --- | --- |
| B/S sheet | ignored; no read projection or Store Operations mapping |
| half-year/cumulative/closing column | ignored; cannot produce a monthly fact |
| unselected P/L sheet | ignored; cannot create an aggregate or store fact |
| comparison/reference material | ignored; cannot enter the import payload |
| unknown selected label | fail closed; publication blocked |

## Dry-run result

A dry-run produces only selected-sheet metadata, aggregate validation counts,
mapping-version identity, and bounded error codes. It does not retain excluded-sheet
financial values. It succeeds only when the 20 selected store mappings validate as
Direct 13 plus FC 7 and the approved headquarters/EC selections are unambiguous.

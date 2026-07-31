# Store P/L PDF reconciliation

Status: **Blocked — the 2026 January–June source PDFs were not provided.**

PDFs are supporting evidence, not the accounting source of truth. Do not infer
results. In a private workspace, extract three stores for at least two months
to UTF-8 CSV with `store_key`, `period` and:

`technical_revenue`, `product_revenue`, `ec_revenue`, `total_revenue`,
`cost_of_sales`, `gross_profit`, `sga`, `operating_profit`, `ordinary_profit`.

Export the same fields from an approved Core version. Run:

```powershell
python tools/accounting/reconcile_store_pl.py `
  --pdf-extract-csv private/pdf.csv `
  --core-export-csv private/core.csv `
  --output private/differences.csv
```

The report contains PDF/Core amount, difference, difference rate, cause
candidate and result. Inputs and output contain confidential amounts and must
remain outside Git. Missing values are `blocked`, never zero-filled.

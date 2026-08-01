# Accounting KPI definitions and feasibility

KPI generation is not implemented in Phase 3-2.

| KPI | Definition | Feasibility |
|---|---|---|
| Gross profit margin | gross profit / revenue | Derivable after approved revenue basis |
| Operating profit margin | operating profit / revenue | Derivable |
| Ordinary profit margin | ordinary profit / revenue | Derivable |
| Equity ratio | net assets / total assets | Derivable |
| Current ratio | current assets / current liabilities | Derivable |
| Quick ratio | quick assets / current liabilities | Unknown: approved quick-asset account set required |
| Fixed ratio | fixed assets / net assets | Derivable |
| ROA | period-adjusted profit / average total assets | Unknown: profit and averaging policy required |
| ROE | period-adjusted net profit / average equity | Unknown: averaging policy required |
| Labor distribution ratio | labor cost / value added | Unknown: both approved account set and value-added definition required |
| Labor cost ratio | labor cost / revenue | Unknown: labor account set unapproved |
| Material cost ratio | material cost / revenue | Unknown: material definition unapproved |
| Rent ratio | rent / revenue | Unknown: rent/lease account distinction unapproved |

All ratios require zero-denominator handling and a single approved tax basis.
Unavailable inputs return `null`, never zero.

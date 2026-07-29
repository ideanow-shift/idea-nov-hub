#!/usr/bin/env python3
"""Compare privately extracted PDF values with Accounting Core export values."""
from __future__ import annotations

import argparse
import csv
from decimal import Decimal
from pathlib import Path

FIELDS = (
    "technical_revenue", "product_revenue", "ec_revenue", "total_revenue",
    "cost_of_sales", "gross_profit", "sga", "operating_profit", "ordinary_profit",
)


def load(path: Path) -> dict[tuple[str, str], dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as source:
        rows = list(csv.DictReader(source))
    return {(row["store_key"], row["period"]): row for row in rows}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf-extract-csv", required=True, type=Path)
    parser.add_argument("--core-export-csv", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    pdf, core = load(args.pdf_extract_csv), load(args.core_export_csv)
    with args.output.open("w", encoding="utf-8-sig", newline="") as target:
        columns = ["store_key","period","metric","pdf_amount","core_amount","difference","difference_rate","cause_candidate","result"]
        writer = csv.DictWriter(target, fieldnames=columns)
        writer.writeheader()
        for key in sorted(set(pdf) | set(core)):
            for metric in FIELDS:
                left = pdf.get(key, {}).get(metric, "")
                right = core.get(key, {}).get(metric, "")
                if left == "" or right == "":
                    writer.writerow(dict(zip(columns, [*key,metric,left,right,"","","missing input","blocked"])))
                    continue
                pdf_amount, core_amount = Decimal(left), Decimal(right)
                difference = core_amount - pdf_amount
                rate = "" if pdf_amount == 0 else difference / abs(pdf_amount)
                result = "match" if abs(difference) <= Decimal("0.5") else "difference"
                cause = "" if result == "match" else "mapping/tax basis/period/allocation/manual PDF adjustment"
                writer.writerow(dict(zip(columns, [*key,metric,left,right,difference,rate,cause,result])))


if __name__ == "__main__":
    main()

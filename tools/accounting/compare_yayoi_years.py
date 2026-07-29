#!/usr/bin/env python3
"""Metadata-only multi-year Yayoi workbook comparison."""
from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path

from accounting_core.year_comparison import audit_year, compare_years


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--workbook",
        action="append",
        nargs=3,
        metavar=("LABEL", "PATH", "CONFIRMED_THROUGH"),
        required=True,
    )
    args = parser.parse_args()
    audits = [
        audit_year(
            label,
            Path(path),
            None if confirmed == "-" else date.fromisoformat(f"{confirmed}-01"),
        )
        for label, path, confirmed in args.workbook
    ]
    print(json.dumps(compare_years(audits), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

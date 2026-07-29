#!/usr/bin/env python3
"""Metadata-only multi-year Yayoi workbook comparison."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from accounting_core.year_comparison import audit_year, compare_years


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workbook", action="append", nargs=2, metavar=("LABEL", "PATH"), required=True)
    args = parser.parse_args()
    audits = [audit_year(label, Path(path)) for label, path in args.workbook]
    print(json.dumps(compare_years(audits), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

from __future__ import annotations

import csv
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


class PdfReconciliationToolTests(unittest.TestCase):
    def test_difference_report_and_missing_input(self):
        root = Path(__file__).parents[2]
        fields = [
            "store_key","period","technical_revenue","product_revenue","ec_revenue",
            "total_revenue","cost_of_sales","gross_profit","sga","operating_profit","ordinary_profit",
        ]
        with tempfile.TemporaryDirectory() as directory:
            work = Path(directory)
            left, right, output = work / "pdf.csv", work / "core.csv", work / "out.csv"
            for path, total in ((left, "100"), (right, "101")):
                with path.open("w", encoding="utf-8", newline="") as target:
                    writer = csv.DictWriter(target, fieldnames=fields)
                    writer.writeheader()
                    writer.writerow({"store_key":"synthetic-store","period":"2026-06","total_revenue":total})
            subprocess.run(
                [sys.executable, str(root / "tools/accounting/reconcile_store_pl.py"),
                 "--pdf-extract-csv", str(left), "--core-export-csv", str(right), "--output", str(output)],
                check=True,
            )
            with output.open(encoding="utf-8-sig", newline="") as source:
                rows = list(csv.DictReader(source))
        total = next(row for row in rows if row["metric"] == "total_revenue")
        missing = next(row for row in rows if row["metric"] == "technical_revenue")
        self.assertEqual("difference", total["result"])
        self.assertEqual("blocked", missing["result"])


if __name__ == "__main__":
    unittest.main()

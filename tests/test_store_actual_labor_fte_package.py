from __future__ import annotations

from decimal import Decimal
import hashlib
import json
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "docs/store_operations_management/production_integration/actual-labor-fte-20260924-production"
CANONICAL = PACKAGE / "actual-labor-fte-canonical-20260924.json"
DRY_RUN = PACKAGE / "actual-labor-fte-production-dry-run.sql"
EXECUTION = PACKAGE / "actual-labor-fte-production.execution.sql"
MANIFEST = PACKAGE / "actual-labor-fte-production.manifest.json"
UNRESOLVED = PACKAGE / "actual-labor-fte-operator-unresolved-20260924.json"
DRY_RESULT = PACKAGE / "actual-labor-fte-production-dry-run-result.json"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


class ActualLaborFtePackageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.rows = json.loads(CANONICAL.read_text(encoding="utf-8"))
        cls.dry = DRY_RUN.read_text(encoding="utf-8")
        cls.sql = EXECUTION.read_text(encoding="utf-8")
        cls.manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))

    def test_canonical_contract_and_formula(self) -> None:
        self.assertEqual(len(self.rows), 671)
        keys = {(row["fiscal_month"], row["unit_key"]) for row in self.rows}
        self.assertEqual(len(keys), 671)
        self.assertEqual(len({row["fiscal_month"] for row in self.rows}), 36)
        self.assertEqual(len({row["store_id"] for row in self.rows}), 20)
        for row in self.rows:
            minutes = Decimal(row["allocated_actual_work_minutes"])
            hours = Decimal(row["allocated_actual_work_hours"])
            fte = Decimal(row["value_quantity"])
            self.assertLessEqual(abs(hours - minutes / 60), Decimal("0.000000001"))
            self.assertLessEqual(abs(fte - hours / Decimal("173.76")), Decimal("0.000000001"))
            self.assertRegex(row["fingerprint_sha256"], r"^[0-9a-f]{64}$")

    def test_sanitized_source_excludes_employee_and_unallocated_pii(self) -> None:
        text = CANONICAL.read_text(encoding="utf-8").lower()
        for forbidden in (
            "employee", "employee_number", "raw_employee_code", "unallocated",
            "no_fte_name_match", "no_fte_placement", "fte_zero",
        ):
            self.assertNotIn(forbidden, text)
        self.assertFalse(self.manifest["sanitizedCanonicalSource"]["containsEmployeeIdentifiers"])
        self.assertEqual(
            self.manifest["planned"]["unallocatedEmployeeMonthsPromoted"], 0
        )
        unresolved = json.loads(UNRESOLVED.read_text(encoding="utf-8"))
        self.assertEqual(
            {(row["fiscal_month"], row["unit_key"]) for row in unresolved},
            {
                (month, "SALON:KYARAHALF")
                for month in ("2023-09", "2023-10", "2023-11", "2023-12", "2024-01")
            },
        )

    def test_read_only_dry_run_has_no_writes(self) -> None:
        sql = re.sub(r"--[^\n]*", "", self.dry.lower())
        for verb in ("insert", "update", "delete", "alter", "create", "drop", "truncate", "commit"):
            self.assertIsNone(re.search(rf"\b{verb}\b", sql), verb)
        self.assertIn("store_corporation_effective_operator_range_read_v1", sql)
        self.assertIn("planned_insert", sql)
        self.assertIn("unresolved_company_operator", sql)

    def test_execution_gate_precedes_every_write_and_is_append_only(self) -> None:
        approval = self.sql.index("OWNER_APPROVAL_REQUIRED_AFTER_FIXED_SHA_REVIEW")
        first_write = min(
            self.sql.index("create temp table"),
            self.sql.index("alter table"),
            self.sql.index("insert into"),
        )
        self.assertLess(approval, first_write)
        self.assertIn("store_corporation_effective_operator_range_read_v1", self.sql)
        self.assertIn("pos-canonical-store-actual-v1", self.sql)
        self.assertIn("round(e.value_quantity,4)", self.sql)
        self.assertIn("SAME_MONTH_OFFICIAL_FTE_PLACEMENT_RATIO", self.sql)
        self.assertIn("actualPunchStore',false", self.sql)
        self.assertIn("shiftBackfill',false", self.sql)
        lower = self.sql.lower()
        self.assertNotRegex(lower, r"update\s+public\.dbf_store_monthly_metric_facts")
        self.assertNotRegex(lower, r"delete\s+from\s+public\.dbf_store_monthly_metric_facts")
        self.assertIn("existing_package_readback_mismatch", lower)
        self.assertIn("final_readback_mismatch", lower)
        self.assertIn("unexpected_operator_grain_missing", lower)
        self.assertIn("between date '2023-09-01' and date '2024-01-01'", lower)
        self.assertIn("missing_effective_operator", lower)
        self.assertIn("timecard_actual_labor_fte_operator_quarantine_v1", lower)
        self.assertIn("'quarantined','quarantined'", lower)

    def test_manifest_fixed_counts_and_hashes(self) -> None:
        self.assertFalse(self.manifest["productionExecuted"])
        self.assertEqual(
            self.manifest["status"],
            "AWAITING_SEPARATE_PRODUCTION_DB_EXECUTION_APPROVAL",
        )
        planned = self.manifest["planned"]
        self.assertEqual(planned["importBatchesInsert"], 41)
        self.assertEqual(planned["rawRowsInsert"], 671)
        self.assertEqual(planned["stagingRowsInsert"], 671)
        self.assertEqual(planned["canonicalFactsInsert"], 666)
        self.assertEqual(planned["operatorUnresolvedRowsPromoted"], 0)
        self.assertEqual(planned["operatorUnresolvedStagingRowsInsert"], 5)
        self.assertEqual(planned["factUpdates"], 0)
        self.assertEqual(planned["factDeletes"], 0)
        dry_result = json.loads(DRY_RESULT.read_text(encoding="utf-8"))
        self.assertTrue(dry_result["executed"])
        self.assertEqual(dry_result["expected_rows"], 671)
        self.assertEqual(dry_result["unresolved_company_operator"], 5)
        self.assertEqual(dry_result["planned_insert"], 666)
        self.assertEqual(dry_result["conflict"], 0)
        for path in (CANONICAL, UNRESOLVED, DRY_RUN, DRY_RESULT, EXECUTION):
            artifact = self.manifest["artifacts"][path.name]
            self.assertEqual(artifact["sha256"], digest(path))
            self.assertEqual(artifact["byteSize"], path.stat().st_size)


if __name__ == "__main__":
    unittest.main()

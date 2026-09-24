from __future__ import annotations

from copy import deepcopy
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest


MODULE_PATH = Path(__file__).parents[1] / "tools" / "store_operating_profit" / "prepare_july_2026_operating_profit.py"
SPEC = importlib.util.spec_from_file_location("prepare_july_2026_operating_profit", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


HEADER = [
    "年月", "法人No", "法人名", "部門名", "department_type",
    "当月_営業利益", "tax_basis", "source_file", "verification_status",
]


def fixture():
    rows = [HEADER]
    for index, label in enumerate(MODULE.DIRECT_STORE_MAPPINGS, start=1):
        rows.append(["2026-07", "0001", "IDEA NOV", label, "SALON", index * 100, "税抜", "source.xlsx", "PASS_CURRENT_ONLY"])
    for label in sorted(MODULE.EXCLUDED_FC_LABELS):
        rows.append(["2026-07", "0001", "IDEA NOV", label, "SALON", 0, "税抜", "source.xlsx", "PASS_CURRENT_ONLY"])
    rows.append(["2026-08", "0001", "IDEA NOV", "所沢", "SALON", 999, "税抜", "source.xlsx", "PASS_CURRENT_ONLY"])
    return rows


class JulyOperatingProfitPackageTest(unittest.TestCase):
    def test_fixed_population_and_counts(self):
        package = MODULE.build_package_from_rows(fixture())
        self.assertEqual(len(package["rows"]), 13)
        self.assertEqual(len(package["excludedFcRows"]), 5)
        self.assertEqual(package["planned"]["canonicalFactsInsert"], 13)
        self.assertEqual(package["planned"]["ddl"], 0)
        self.assertEqual(len({row["storeId"] for row in package["rows"]}), 13)

    def test_explicit_mapping_only(self):
        changed = fixture()
        changed[1][3] = "KYARA HALF池袋"
        with self.assertRaisesRegex(ValueError, "JULY_SALON_POPULATION_MISMATCH"):
            MODULE.build_package_from_rows(changed)

    def test_nonzero_fc_row_fails_closed(self):
        changed = fixture()
        fc_index = next(i for i, row in enumerate(changed) if row[3] in MODULE.EXCLUDED_FC_LABELS)
        changed[fc_index][5] = 1
        with self.assertRaisesRegex(ValueError, "EXCLUDED_FC_NONZERO"):
            MODULE.build_package_from_rows(changed)

    def test_missing_or_unverified_profit_fails_closed(self):
        missing = fixture()
        missing[1][5] = None
        with self.assertRaisesRegex(ValueError, "OPERATING_PROFIT_MISSING"):
            MODULE.build_package_from_rows(missing)
        unverified = fixture()
        unverified[1][8] = "WARNING"
        with self.assertRaisesRegex(ValueError, "SOURCE_VERIFICATION_STATUS_MISMATCH"):
            MODULE.build_package_from_rows(unverified)

    def test_detail_count_is_fixed(self):
        with self.assertRaisesRegex(ValueError, "JULY_DETAIL_ROW_COUNT_MISMATCH"):
            MODULE.build_package_from_rows(fixture(), detail_row_count=3381)

    def test_package_identity_is_deterministic(self):
        left = MODULE.build_package_from_rows(fixture())
        right = MODULE.build_package_from_rows(deepcopy(fixture()))
        self.assertEqual(left["identity"], right["identity"])
        self.assertEqual(left["rows"], right["rows"])

    def test_execution_sql_uses_dbf_promotion_and_append_only_facts(self):
        sql = MODULE.build_execution_sql(MODULE.build_package_from_rows(fixture()))
        self.assertIn("dbf_import_approve_v1", sql)
        self.assertIn("dbf_import_promote_v1", sql)
        self.assertIn("'nov_hub_secure_session'", sql)
        self.assertIn("OWNER_APPROVAL_GATE_REQUIRED", sql)
        self.assertIn(MODULE.APPROVAL_GATE_SETTING, sql)
        self.assertIn("CANONICAL_READBACK_MISMATCH", sql)
        self.assertNotIn("update public.dbf_store_monthly_metric_facts", sql.lower())
        self.assertNotIn("delete from public.dbf_store_monthly_metric_facts", sql.lower())
        self.assertNotIn("drop table", sql.lower())

    def test_raw_payload_hashes_match_db_constraint(self):
        package = MODULE.build_package_from_rows(fixture())
        for row in package["rows"]:
            self.assertRegex(row["rawPayloadSha256"], r"^[0-9a-f]{64}$")

    def test_committed_manifest_matches_fixed_artifacts(self):
        root = Path(__file__).parents[1]
        output = root / "docs" / "store_operations_management" / "production_integration" / "store-operating-profit-2026-07"
        manifest = json.loads((output / "store-operating-profit-2026-07.manifest.json").read_text(encoding="utf-8"))
        self.assertFalse(manifest["productionExecuted"])
        self.assertEqual(manifest["sourceSha256"], MODULE.SOURCE_SHA256)
        self.assertEqual(manifest["packageSha256"], "10F012FDFA51303B3C68DDC7ACB9B854A85630DCC2DA423B16557966B4E0B7B3")
        self.assertEqual(manifest["executionApprovalGate"]["setting"], MODULE.APPROVAL_GATE_SETTING)
        self.assertEqual(manifest["executionApprovalGate"]["requiredValue"], MODULE.APPROVAL_GATE_VALUE)
        for filename, expected in manifest["artifacts"].items():
            actual = hashlib.sha256((output / filename).read_bytes()).hexdigest().upper()
            self.assertEqual(actual, expected)
        package = json.loads((output / "store-operating-profit-2026-07.package.json").read_text(encoding="utf-8"))
        self.assertEqual(package["identity"]["packageSha256"], manifest["packageSha256"])
        self.assertEqual(package["planned"], manifest["planned"])
        self.assertEqual(len(package["rows"]), 13)
        self.assertEqual(len(package["excludedFcRows"]), 5)


if __name__ == "__main__":
    unittest.main()

from __future__ import annotations

import unittest
from dataclasses import replace
from datetime import date
from decimal import Decimal
from pathlib import Path

from accounting_kpi.calculator import ExpressionError, KpiCalculator, validate_expression
from accounting_kpi.core_adapter import CoreProjectionError, PublishedCoreProjection
from accounting_kpi.domain import ApprovalStatus, CoreFact, DataState
from accounting_kpi.registry import load_account_groups, load_definitions
from accounting_kpi.repository import KpiRepository, open_database
from accounting_kpi.workflow import KpiWorkflow

FORMAL = (
    "gross_profit_margin",
    "operating_profit_margin",
    "ordinary_profit_margin",
    "net_profit_margin",
    "equity_ratio",
    "current_ratio",
)


def facts(version="version-a", period=date(2026, 6, 1), **overrides):
    amounts = {
        "total_revenue": "1000",
        "gross_profit": "400",
        "operating_profit": "200",
        "ordinary_profit": "180",
        "net_profit": "120",
        "total_assets": "2000",
        "current_assets": "900",
        "current_liabilities": "600",
        "net_assets": "800",
    }
    return [
        CoreFact(
            id=f"fact-{version}-{account}",
            accounting_version_id=version,
            entity_id="entity-a",
            scope_type="legal_entity",
            period=period,
            canonical_account=account,
            amount=Decimal(amount),
            amount_basis="net",
            confirmed_through_period=period,
            **overrides,
        )
        for account, amount in amounts.items()
    ]


class KpiEngineTests(unittest.TestCase):
    def setUp(self):
        root = Path(__file__).parents[2]
        self.definitions = load_definitions(root / "docs/accounting/accounting-kpi-definition-registry.json")
        self.groups = load_account_groups(root / "docs/accounting/accounting-kpi-account-groups.json")
        self.db = open_database()
        self.repository = KpiRepository(self.db)
        self.repository.seed(self.definitions, self.groups)

    def approve_formal(self):
        required_groups = {
            code
            for definition in self.definitions if definition.code in FORMAL
            for code in definition.required_account_groups
        }
        for code in required_groups:
            self.repository.approve_group(code, "kpi-admin")
        for code in FORMAL:
            self.repository.approve_definition(code, "kpi-admin")

    def run_formal(self, fact_rows=None, version="version-a"):
        self.approve_formal()
        rows = fact_rows or facts(version)
        workflow = KpiWorkflow(self.repository, PublishedCoreProjection(rows))
        return workflow.run(version, "entity-a", "legal_entity", date(2026, 6, 1), "system", FORMAL)

    def test_registry_starts_proposed_and_records_approval_history(self):
        self.assertEqual(20, len(self.definitions))
        self.assertTrue(all(item.approval_status is ApprovalStatus.PROPOSED for item in self.definitions))
        self.assertEqual(9, len(self.groups))
        self.repository.approve_definition("gross_profit_margin", "admin")
        audit = self.db.execute("SELECT action FROM accounting_kpi_audit_logs").fetchone()[0]
        self.assertEqual("definition_approved", audit)

    def test_six_formal_kpis_calculate_with_decimal(self):
        run_id, results = self.run_formal()
        values = {result.definition_id: result.value for result in results}
        by_code = {
            definition.code: values[definition.id]
            for definition in self.repository.definitions.values()
            if definition.code in FORMAL
        }
        self.assertEqual(Decimal("0.4"), by_code["gross_profit_margin"])
        self.assertEqual(Decimal("0.2"), by_code["operating_profit_margin"])
        self.assertEqual(Decimal("0.18"), by_code["ordinary_profit_margin"])
        self.assertEqual(Decimal("0.12"), by_code["net_profit_margin"])
        self.assertEqual(Decimal("0.4"), by_code["equity_ratio"])
        self.assertEqual(Decimal("1.5"), by_code["current_ratio"])
        self.assertTrue(all(result.data_state is DataState.AVAILABLE for result in results))
        self.assertEqual("completed", self.db.execute("SELECT status FROM accounting_kpi_calculation_runs WHERE id=?", (run_id,)).fetchone()[0])

    def test_unapproved_definition_is_preparing(self):
        definition = self.repository.definitions["gross_profit_margin"]
        result = KpiCalculator().calculate(definition, self.repository.groups, facts(), "run")
        self.assertEqual((None, DataState.PREPARING, "DEFINITION_NOT_APPROVED"),
                         (result.value, result.data_state, result.reason_code))

    def test_unapproved_group_prevents_formal_calculation(self):
        self.repository.approve_definition("gross_profit_margin", "admin")
        result = KpiCalculator().calculate(
            self.repository.definitions["gross_profit_margin"], self.repository.groups, facts(), "run"
        )
        self.assertEqual("ACCOUNT_GROUP_NOT_APPROVED", result.reason_code)

    def test_zero_denominator_is_not_zero_percent(self):
        self.approve_formal()
        rows = [replace(row, amount=Decimal(0)) if row.canonical_account == "total_revenue" else row for row in facts()]
        result = KpiCalculator().calculate(
            self.repository.definitions["gross_profit_margin"], self.repository.groups, rows, "run"
        )
        self.assertEqual((None, DataState.UNAVAILABLE, "ZERO_DENOMINATOR"),
                         (result.value, result.data_state, result.reason_code))

    def test_missing_component_is_not_zero_filled(self):
        self.approve_formal()
        rows = [row for row in facts() if row.canonical_account != "gross_profit"]
        result = KpiCalculator().calculate(
            self.repository.definitions["gross_profit_margin"], self.repository.groups, rows, "run"
        )
        self.assertEqual((None, DataState.PREPARING, "MISSING_COMPONENT"),
                         (result.value, result.data_state, result.reason_code))
        self.assertEqual(("gross_profit",), result.missing_components)

    def test_negative_denominator_is_validation_error(self):
        self.approve_formal()
        rows = [replace(row, amount=Decimal("-1000")) if row.canonical_account == "total_revenue" else row for row in facts()]
        result = KpiCalculator().calculate(
            self.repository.definitions["gross_profit_margin"], self.repository.groups, rows, "run"
        )
        self.assertEqual("NEGATIVE_DENOMINATOR", result.reason_code)
        self.assertEqual(DataState.VALIDATION_ERROR, result.data_state)

    def test_amount_basis_mixing_is_rejected(self):
        self.approve_formal()
        rows = [replace(row, amount_basis="gross") if row.canonical_account == "gross_profit" else row for row in facts()]
        result = KpiCalculator().calculate(
            self.repository.definitions["gross_profit_margin"], self.repository.groups, rows, "run"
        )
        self.assertEqual("AMOUNT_BASIS_MISMATCH", result.reason_code)

    def test_unpublished_pending_carry_and_superseded_are_rejected(self):
        cases = (
            {"version_status": "imported"},
            {"closing_status": "pending"},
            {"carry_forward": True},
            {"active_projection": False, "version_status": "superseded"},
        )
        for overrides in cases:
            with self.subTest(overrides=overrides):
                projection = PublishedCoreProjection(facts(**overrides))
                with self.assertRaises(CoreProjectionError):
                    projection.facts_for("version-a", "entity-a", "legal_entity", date(2026, 6, 1))

    def test_unconfirmed_period_is_rejected(self):
        rows = [replace(row, confirmed_through_period=date(2026, 5, 1)) for row in facts()]
        with self.assertRaisesRegex(CoreProjectionError, "PERIOD_NOT_CONFIRMED"):
            PublishedCoreProjection(rows).facts_for("version-a", "entity-a", "legal_entity", date(2026, 6, 1))

    def test_rollback_restore_creates_new_run_and_keeps_old_results(self):
        run_a, results_a = self.run_formal()
        rows_b = facts("rollback-c")
        workflow = KpiWorkflow(self.repository, PublishedCoreProjection(rows_b))
        run_c, results_c = workflow.run("rollback-c", "entity-a", "legal_entity", date(2026, 6, 1), "system", FORMAL)
        self.assertNotEqual(run_a, run_c)
        self.assertEqual(12, self.db.execute("SELECT COUNT(*) FROM accounting_kpi_results").fetchone()[0])
        self.assertEqual(results_a[0].value, results_c[0].value)

    def test_provenance_tracks_definition_run_groups_and_facts(self):
        _, results = self.run_formal()
        rows = self.repository.provenance(results[0].id)
        self.assertEqual(2, len(rows))
        self.assertEqual({"numerator", "denominator"}, {row["input_role"] for row in rows})
        self.assertTrue(all(row["accounting_fact_id"].startswith("fact-") for row in rows))

    def test_expression_code_injection_is_rejected(self):
        with self.assertRaises(ExpressionError):
            validate_expression({"op": "__import__", "code": "os.system"})
        with self.assertRaises(ExpressionError):
            validate_expression({"op": "account_group", "code": "x", "sql": "drop table"})

    def test_leaf_and_summary_are_not_mixed(self):
        store_rows = [replace(row, scope_type="store", entity_id="store-a") for row in facts()]
        summary_rows = [replace(row, scope_type="legal_entity", entity_id="entity-a") for row in facts()]
        selected = PublishedCoreProjection(store_rows + summary_rows).facts_for(
            "version-a", "store-a", "store", date(2026, 6, 1)
        )
        self.assertTrue(all(row.scope_type == "store" and row.entity_id == "store-a" for row in selected))

    def test_engine_cannot_update_core_fact(self):
        with self.assertRaises(PermissionError):
            PublishedCoreProjection(facts()).update_fact("fact", Decimal(0))

    def test_account_group_effective_period_supports_three_years(self):
        self.repository.approve_group("total_revenue", "admin")
        group = self.repository.groups["total_revenue"]
        for period in (date(2024, 6, 1), date(2025, 6, 1), date(2026, 6, 1)):
            self.assertLessEqual(group.member_effective_from, period)


if __name__ == "__main__":
    unittest.main()

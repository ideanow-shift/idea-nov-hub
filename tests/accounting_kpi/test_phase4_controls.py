from __future__ import annotations

import unittest
from dataclasses import replace
from datetime import date
from decimal import Decimal
from pathlib import Path

from accounting_kpi.cli import metadata_report
from accounting_kpi.consumer import (
    ConsumerAccessError, ConsumerProjection, corporate_api, display_percent, store_api,
)
from accounting_kpi.domain import KpiActorContext, KpiActorRole, KpiScopeType
from accounting_kpi.lifecycle import DefinitionSetService, FORMAL_KPIS, LifecycleError
from accounting_kpi.registry import load_account_groups, load_definitions
from accounting_kpi.repository import DuplicateCompletedRun, KpiRepository, open_database
from accounting_kpi.core_adapter import PublishedCoreProjection
from accounting_kpi.workflow import KpiWorkflow
from tests.accounting_kpi.test_kpi_engine import facts


def actor(actor_id: str, role: KpiActorRole, scope: KpiScopeType = KpiScopeType.ALL_GROUP,
          ids: tuple[str, ...] = (), trusted: bool = True) -> KpiActorContext:
    return KpiActorContext(actor_id, role, scope, frozenset(ids), trusted)


ADMIN = actor("admin", KpiActorRole.KPI_ADMIN)
EDITOR = actor("editor", KpiActorRole.KPI_DEFINITION_EDITOR)
ACCOUNTING = actor("accounting", KpiActorRole.ACCOUNTING_DEFINITION_REVIEWER)
MANAGEMENT = actor("management", KpiActorRole.MANAGEMENT_DEFINITION_APPROVER)
EXECUTIVE = actor("executive", KpiActorRole.EXECUTIVE_VIEWER)


class Phase4ControlTests(unittest.TestCase):
    def setUp(self):
        root = Path(__file__).parents[2]
        definitions = load_definitions(root / "docs/accounting/accounting-kpi-definition-registry.json")
        groups = load_account_groups(root / "docs/accounting/accounting-kpi-account-groups.json")
        self.db = open_database()
        self.repo = KpiRepository(self.db)
        self.repo.seed(definitions, groups)
        self.lifecycle = DefinitionSetService(self.db)

    def approve_registry(self):
        needed = {
            group for code in FORMAL_KPIS
            for group in self.repo.definitions[code].required_account_groups
        }
        for code in needed:
            self.repo.approve_group(code, "accounting")
        for code in FORMAL_KPIS:
            self.repo.approve_definition(code, "management")

    def release_set(self, version="phase4-v1"):
        self.approve_registry()
        set_id = self.lifecycle.create(version, EDITOR, date(2026, 1, 1))
        self.lifecycle.accounting_review(set_id, ACCOUNTING, "formula checked")
        self.lifecycle.management_approve(set_id, MANAGEMENT, "business use approved")
        self.lifecycle.release(set_id, ADMIN, "prototype release")
        return set_id

    def calculate(self, entity="entity-a", scope="legal_entity"):
        rows = [
            row.__class__(**{**row.__dict__, "entity_id": entity, "scope_type": scope})
            for row in facts()
        ]
        return KpiWorkflow(self.repo, PublishedCoreProjection(rows)).run(
            "version-a", entity, scope, date(2026, 6, 1), "worker", FORMAL_KPIS
        )

    def test_two_stage_approval_and_release_are_separate_and_audited(self):
        self.approve_registry()
        set_id = self.lifecycle.create("phase4-v1", EDITOR, date(2026, 1, 1))
        self.assertEqual("proposed", self.lifecycle.status(set_id))
        self.lifecycle.accounting_review(set_id, ACCOUNTING, "checked")
        self.assertEqual("accounting_approved", self.lifecycle.status(set_id))
        self.lifecycle.management_approve(set_id, MANAGEMENT, "approved")
        self.lifecycle.release(set_id, ADMIN, "released")
        self.assertEqual("released", self.lifecycle.status(set_id))
        self.assertEqual(4, self.db.execute(
            "SELECT COUNT(*) FROM accounting_kpi_audit_logs WHERE target_id=?", (set_id,)
        ).fetchone()[0])

    def test_wrong_actor_cannot_approve_or_release(self):
        self.approve_registry()
        set_id = self.lifecycle.create("phase4-v1", EDITOR, date(2026, 1, 1))
        with self.assertRaises(PermissionError):
            self.lifecycle.accounting_review(set_id, MANAGEMENT, "forged")
        with self.assertRaises(PermissionError):
            self.lifecycle.release(set_id, actor("x", KpiActorRole.EMPLOYEE), "forged")

    def test_unapproved_group_blocks_release(self):
        set_id = self.lifecycle.create("phase4-v1", EDITOR, date(2026, 1, 1))
        self.lifecycle.accounting_review(set_id, ACCOUNTING, "review only")
        self.lifecycle.management_approve(set_id, MANAGEMENT, "approve only")
        with self.assertRaises(LifecycleError):
            self.lifecycle.release(set_id, ADMIN, "unsafe")

    def test_definition_set_supersede_preserves_history(self):
        old = self.release_set()
        new = self.lifecycle.create("phase4-v2", EDITOR, date(2026, 7, 1))
        self.lifecycle.accounting_review(new, ACCOUNTING, "checked")
        self.lifecycle.management_approve(new, MANAGEMENT, "approved")
        self.lifecycle.release(new, ADMIN, "released")
        self.lifecycle.supersede(old, new, ADMIN, "new formula set")
        self.assertEqual(("superseded", "released"), (self.lifecycle.status(old), self.lifecycle.status(new)))

    def test_definition_supersede_keeps_old_row_and_requires_higher_version(self):
        current = self.repo.definitions["equity_ratio"]
        replacement = replace(
            current, id="equity-ratio-v2", definition_version=2,
            supersedes_definition_id=current.id,
        )
        self.repo.supersede_definition("equity_ratio", replacement, "editor", "versioned clarification")
        rows = self.db.execute(
            "SELECT definition_version,approval_status FROM accounting_kpi_definitions WHERE kpi_code='equity_ratio' ORDER BY definition_version"
        ).fetchall()
        self.assertEqual([(1, "inactive"), (2, "proposed")], [tuple(row) for row in rows])

    def test_idempotent_completed_run_is_reused(self):
        self.release_set()
        run_a, results = self.calculate()
        run_b, duplicate_results = self.calculate()
        self.assertEqual(run_a, run_b)
        self.assertEqual([], duplicate_results)
        self.assertEqual(6, len(results))
        self.assertEqual(1, self.db.execute(
            "SELECT COUNT(*) FROM accounting_kpi_calculation_runs"
        ).fetchone()[0])

    def test_concurrent_running_run_is_locked(self):
        first = self.repo.create_run("version-a", "entity-a", "legal_entity", "2026-06-01", "a")
        with self.assertRaises(DuplicateCompletedRun):
            self.repo.create_run("version-a", "entity-a", "legal_entity", "2026-06-01", "b")
        self.assertIsNotNone(first)

    def test_retry_is_new_attempt_and_does_not_overwrite_failure(self):
        failed = self.repo.create_run("version-a", "entity-a", "legal_entity", "2026-06-01", "a")
        self.db.execute("UPDATE accounting_kpi_calculation_runs SET status='failed' WHERE id=?", (failed,))
        retry = self.repo.create_run(
            "version-a", "entity-a", "legal_entity", "2026-06-01", "b", retry_of_run_id=failed
        )
        rows = self.db.execute(
            "SELECT id,status,retry_of_run_id,attempt_number FROM accounting_kpi_calculation_runs ORDER BY attempt_number"
        ).fetchall()
        self.assertEqual(("failed", failed, 2), (rows[0]["status"], rows[1]["retry_of_run_id"], rows[1]["attempt_number"]))
        self.assertNotEqual(failed, retry)

    def test_result_supersede_removes_old_active_projection(self):
        self.release_set()
        run_id, _ = self.calculate()
        self.repo.supersede_run(run_id, "admin", "rollback restore")
        self.assertEqual("superseded", self.db.execute(
            "SELECT status FROM accounting_kpi_calculation_runs WHERE id=?", (run_id,)
        ).fetchone()[0])
        self.assertEqual(6, self.db.execute(
            "SELECT COUNT(*) FROM accounting_kpi_results WHERE superseded_at IS NOT NULL"
        ).fetchone()[0])

    def test_rollback_deactivation_removes_old_accounting_version(self):
        self.release_set()
        run_id, _ = self.calculate()
        self.repo.deactivate_accounting_version("version-a", "admin", "rollback restore")
        self.assertEqual("superseded", self.db.execute(
            "SELECT status FROM accounting_kpi_calculation_runs WHERE id=?", (run_id,)
        ).fetchone()[0])
        with self.assertRaises(LookupError):
            corporate_api(ConsumerProjection(self.db), EXECUTIVE, "entity-a", "legal_entity", "2026-06-01")

    def test_store_api_returns_only_own_three_margins_without_provenance(self):
        self.release_set()
        self.calculate("store-a", "store")
        manager = actor("sm", KpiActorRole.STORE_MANAGER, KpiScopeType.STORE, ("store-a",))
        payload = store_api(
            ConsumerProjection(self.db), manager, "store-a", "2026-06-01",
            {"store_id": "store-b", "role": "kpi_admin"},
        )
        self.assertEqual(
            {"gross_profit_margin", "operating_profit_margin", "ordinary_profit_margin"},
            {item["kpi_code"] for item in payload["kpis"]},
        )
        self.assertNotIn("numerator_value", payload["kpis"][0])
        self.assertNotIn("fact_id", str(payload))

    def test_store_manager_other_store_employee_and_untrusted_are_denied(self):
        projection = ConsumerProjection(self.db)
        manager = actor("sm", KpiActorRole.STORE_MANAGER, KpiScopeType.STORE, ("store-a",))
        with self.assertRaises(ConsumerAccessError):
            store_api(projection, manager, "store-b", "2026-06-01")
        with self.assertRaises(ConsumerAccessError):
            projection.get(actor("e", KpiActorRole.EMPLOYEE, KpiScopeType.NONE), "store-a", "store", "2026-06-01")
        with self.assertRaises(ConsumerAccessError):
            projection.get(actor("x", KpiActorRole.KPI_ADMIN, trusted=False), "store-a", "store", "2026-06-01")

    def test_department_and_franchise_cross_scope_are_denied(self):
        projection = ConsumerProjection(self.db)
        department = actor("dm", KpiActorRole.DEPARTMENT_MANAGER, KpiScopeType.DEPARTMENT, ("dept-a",))
        owner = actor("fc", KpiActorRole.FRANCHISE_OWNER, KpiScopeType.FRANCHISE_COMPANY, ("fc-a",))
        with self.assertRaises(ConsumerAccessError):
            projection.get(department, "dept-b", "department", "2026-06-01")
        with self.assertRaises(ConsumerAccessError):
            projection.get(owner, "fc-b", "franchise_company", "2026-06-01")
        with self.assertRaises(ConsumerAccessError):
            projection.get(owner, "hq", "all_group", "2026-06-01")

    def test_unreleased_failed_and_superseded_are_not_projected(self):
        self.approve_registry()
        self.calculate()
        with self.assertRaises(LookupError):
            ConsumerProjection(self.db).get(EXECUTIVE, "entity-a", "legal_entity", "2026-06-01")
        self.release_set()
        run_id = self.db.execute("SELECT id FROM accounting_kpi_calculation_runs").fetchone()[0]
        self.db.execute("UPDATE accounting_kpi_calculation_runs SET status='failed' WHERE id=?", (run_id,))
        with self.assertRaises(LookupError):
            corporate_api(ConsumerProjection(self.db), EXECUTIVE, "entity-a", "legal_entity", "2026-06-01")

    def test_general_actor_cannot_view_admin_provenance(self):
        with self.assertRaises(ConsumerAccessError):
            ConsumerProjection(self.db).admin_provenance(EXECUTIVE, "result")

    def test_percentage_rounding_is_half_up_and_raw_is_unchanged(self):
        raw = Decimal("0.18456")
        self.assertEqual(Decimal("18.5"), display_percent(raw))
        self.assertEqual(Decimal("0.18456"), raw)

    def test_metadata_cli_excludes_values_and_fact_ids(self):
        self.release_set()
        run_id, _ = self.calculate()
        report = metadata_report(self.db, run_id)
        self.assertEqual(6, report["result_count"])
        self.assertNotIn("value", report)
        self.assertNotIn("fact_id", report)


if __name__ == "__main__":
    unittest.main()

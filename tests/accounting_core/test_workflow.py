from __future__ import annotations

import sqlite3
import unittest

from accounting_core.auth import AuthorizationError
from accounting_core.cli import report
from accounting_core.domain import ActorContext, ActorRole, ActorScopeType
from accounting_core.staging import open_database
from accounting_core.workflow import AccountingWorkflow, WorkflowError


def actor(actor_id, role, scope=ActorScopeType.ALL_GROUP, ids=()):
    return ActorContext(actor_id, role, scope, frozenset(ids))


ADMIN = actor("admin", ActorRole.ACCOUNTING_ADMIN)
ACCOUNTING = actor("accounting", ActorRole.ACCOUNTING_REVIEWER)
MANAGEMENT = actor("management", ActorRole.MANAGEMENT_APPROVER)
EXECUTIVE = actor("executive", ActorRole.EXECUTIVE_VIEWER)
EMPLOYEE = actor("employee", ActorRole.EMPLOYEE, ActorScopeType.NONE)


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.db = open_database()
        self.workflow = AccountingWorkflow(self.db)
        self.db.execute("INSERT INTO accounting_import_batches(id,source_system,status,created_by) VALUES('batch','yayoi_excel','imported','admin')")
        self.db.execute("INSERT INTO accounting_import_files(id,batch_id,source_system,file_hash,original_file_name,detected_period,confirmed_through_period) VALUES('file','batch','yayoi_excel','hash-a','masked.xlsx','2026-06-01','2026-06-01')")
        self.db.execute("INSERT INTO accounting_entity_mappings(id,source_system,source_entity_name,scope_type,core_entity_id,status) VALUES('em','yayoi_excel','STORE-A','store','store-a','approved')")
        self.db.execute("""INSERT INTO accounting_account_mappings(
          id,source_system,statement_type,section,source_account_name,parent_context,
          source_sheet_type,occurrence_context,normalized_account,status
        ) VALUES('am','yayoi_excel','pl','sales','売上高合計','sales','pl','sales:1','total_revenue','approved')""")
        self.db.execute("""INSERT INTO accounting_raw_values(
          id,import_file_id,source_sheet,source_sheet_type,source_row,source_column,
          source_cell_reference,source_column_label,detected_period,source_value_state,
          fiscal_year,statement_type,source_entity_name,scope_type,source_account_name,amount_net
        ) VALUES('raw','file','損・STORE-A','pl',10,12,'L10','6月','2026-06-01','amount',2025,'pl','STORE-A','store','売上高合計','100')""")

    def create(self, kind="draft", prior=None, supersedes=None):
        version = self.workflow.create_version("file", 2026, 6, "store", "store-a", kind, ADMIN, prior, supersedes)
        self.db.execute("""INSERT INTO accounting_facts(
          id,raw_value_id,version_id,source_file_id,normalized_account,entity_id,
          scope_type,scope_id,period,amount_net,tax_basis,status
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""",
        ("fact-" + version.id, "raw", version.id, "file", "total_revenue", "store-a",
         "store", "store-a", "2026-06-01", "100", "tax_exclusive", "validated"))
        return version

    def approve_and_publish(self, version):
        self.workflow.validate_version(version.id, ACCOUNTING)
        self.workflow.approve(version.id, "accounting", "approved", "checked", ACCOUNTING)
        self.workflow.approve(version.id, "management", "approved", "release", MANAGEMENT)
        self.workflow.publish(version.id, ADMIN)

    def test_full_publish_flow_and_projection(self):
        version = self.create()
        self.approve_and_publish(version)
        rows = self.workflow.consumer_facts(EXECUTIVE, "store", "store-a")
        self.assertEqual(1, len(rows))
        metadata = report(self.db, version.id)
        self.assertEqual(1, metadata["consumer_projection_count"])
        self.assertEqual("2026-06-01", metadata["confirmed_through_period"])
        self.assertEqual("confirmed", metadata["closing_status"])
        self.assertNotIn("amount_net", metadata)

    def test_rejections_are_terminal_and_audited(self):
        version = self.create()
        self.workflow.validate_version(version.id, ACCOUNTING)
        self.workflow.approve(version.id, "accounting", "rejected", "period not confirmed", ACCOUNTING)
        status = self.db.execute("SELECT status FROM accounting_versions WHERE id=?", (version.id,)).fetchone()[0]
        audit = self.db.execute("SELECT reason FROM accounting_audit_logs WHERE target_id=? AND action='accounting_rejected'", (version.id,)).fetchone()[0]
        self.assertEqual("accounting_rejected", status)
        self.assertEqual("period not confirmed", audit)

    def test_accounting_approval_alone_cannot_publish(self):
        version = self.create()
        self.workflow.validate_version(version.id, ACCOUNTING)
        self.workflow.approve(version.id, "accounting", "approved", "checked", ACCOUNTING)
        with self.assertRaises(WorkflowError):
            self.workflow.publish(version.id, ADMIN)

    def test_management_cannot_approve_without_accounting(self):
        version = self.create()
        self.workflow.validate_version(version.id, ACCOUNTING)
        with self.assertRaises(WorkflowError):
            self.workflow.approve(version.id, "management", "approved", "release", MANAGEMENT)

    def test_blocking_validation_prevents_validation(self):
        version = self.create()
        self.db.execute("INSERT INTO accounting_validation_results(id,import_file_id,version_id,code,severity,masked_message) VALUES('vr','file',?,'X','blocking','masked')", (version.id,))
        with self.assertRaises(WorkflowError):
            self.workflow.validate_version(version.id, ACCOUNTING)

    def test_july_duplicate_period_block_prevents_publish(self):
        self.db.execute(
            "UPDATE accounting_import_files SET detected_period='2026-07-01',confirmed_through_period='2026-06-01',publish_block_reason='June and July duplicate requires confirmation' WHERE id='file'"
        )
        version = self.workflow.create_version("file", 2026, 7, "store", "store-a", "draft", ADMIN)
        self.db.execute("""INSERT INTO accounting_facts(
          id,raw_value_id,version_id,source_file_id,normalized_account,entity_id,
          scope_type,scope_id,period,amount_net,tax_basis,status
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""",
        ("fact-july", "raw", version.id, "file", "total_revenue", "store-a",
         "store", "store-a", "2026-07-01", "100", "tax_exclusive", "validated"))
        self.workflow.validate_version(version.id, ACCOUNTING)
        self.workflow.approve(version.id, "accounting", "approved", "checked", ACCOUNTING)
        self.workflow.approve(version.id, "management", "approved", "release", MANAGEMENT)
        with self.assertRaises(WorkflowError):
            self.workflow.publish(version.id, ADMIN)
        self.assertEqual([], self.workflow.consumer_facts(EXECUTIVE, "store", "store-a"))

    def test_rejected_entity_mapping_prevents_publish(self):
        version = self.create()
        self.workflow.validate_version(version.id, ACCOUNTING)
        self.workflow.approve(version.id, "accounting", "approved", "ok", ACCOUNTING)
        self.workflow.approve(version.id, "management", "approved", "ok", MANAGEMENT)
        self.db.execute("UPDATE accounting_entity_mappings SET status='rejected'")
        with self.assertRaises(WorkflowError):
            self.workflow.publish(version.id, ADMIN)

    def test_unapproved_account_mapping_prevents_publish(self):
        version = self.create()
        self.workflow.validate_version(version.id, ACCOUNTING)
        self.workflow.approve(version.id, "accounting", "approved", "ok", ACCOUNTING)
        self.workflow.approve(version.id, "management", "approved", "ok", MANAGEMENT)
        self.db.execute("UPDATE accounting_account_mappings SET status='proposed'")
        with self.assertRaises(WorkflowError):
            self.workflow.publish(version.id, ADMIN)

    def test_employee_cannot_read(self):
        version = self.create()
        self.approve_and_publish(version)
        with self.assertRaises(AuthorizationError):
            self.workflow.consumer_facts(EMPLOYEE, "store", "store-a")

    def test_store_manager_cannot_read_other_store_or_swap_body_id(self):
        manager = actor("sm", ActorRole.STORE_MANAGER, ActorScopeType.STORE, ("store-a",))
        with self.assertRaises(AuthorizationError):
            self.workflow.consumer_facts(manager, "store", "store-b")

    def test_franchise_owner_cannot_read_other_franchise_or_headquarters(self):
        owner = actor("fc", ActorRole.FRANCHISE_OWNER, ActorScopeType.FRANCHISE_COMPANY, ("fc-a",))
        with self.assertRaises(AuthorizationError):
            self.workflow.consumer_facts(owner, "franchise_company", "fc-b")
        with self.assertRaises(AuthorizationError):
            self.workflow.consumer_facts(owner, "legal_entity", "headquarters")

    def test_untrusted_client_cannot_self_declare_admin(self):
        forged = ActorContext("client", ActorRole.ACCOUNTING_ADMIN, ActorScopeType.ALL_GROUP, frozenset(), False)
        with self.assertRaises(AuthorizationError):
            self.workflow.create_version("file", 2026, 6, "store", "store-a", "draft", forged)

    def test_unpublished_version_is_not_projected(self):
        self.create()
        self.assertEqual([], self.workflow.consumer_facts(EXECUTIVE, "store", "store-a"))

    def test_published_fact_is_immutable(self):
        version = self.create()
        self.approve_and_publish(version)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE accounting_facts SET amount_net='999' WHERE version_id=?", (version.id,))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM accounting_facts WHERE version_id=?", (version.id,))

    def test_supersede_and_rollback_restore(self):
        a = self.create("final")
        self.approve_and_publish(a)
        b = self.create("revision", prior=a.id, supersedes=a.id)
        self.approve_and_publish(b)
        self.assertEqual("superseded", self.db.execute("SELECT status FROM accounting_versions WHERE id=?", (a.id,)).fetchone()[0])
        restored = self.workflow.rollback(b.id, a.id, ACCOUNTING, MANAGEMENT, ADMIN, "revision issue")
        self.assertEqual("rollback_restore", self.db.execute("SELECT version_type FROM accounting_versions WHERE id=?", (restored.id,)).fetchone()[0])
        projected = self.workflow.consumer_facts(EXECUTIVE, "store", "store-a")
        self.assertEqual(restored.id, projected[0]["version_id"])
        self.assertEqual(3, self.db.execute("SELECT COUNT(*) FROM accounting_versions").fetchone()[0])

    def test_other_scope_cannot_rollback(self):
        a = self.create("final")
        self.approve_and_publish(a)
        b = self.create("revision", prior=a.id, supersedes=a.id)
        self.approve_and_publish(b)
        wrong = actor("wrong", ActorRole.ACCOUNTING_ADMIN, ActorScopeType.STORE, ("store-b",))
        with self.assertRaises(AuthorizationError):
            self.workflow.rollback(b.id, a.id, ACCOUNTING, MANAGEMENT, wrong, "issue")

    def test_duplicate_file_is_rejected(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO accounting_import_files(id,batch_id,source_system,file_hash,original_file_name) VALUES('file2','batch','yayoi_excel','hash-a','masked2.xlsx')")

    def test_only_one_active_publication_per_scope_period(self):
        a = self.create()
        self.approve_and_publish(a)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""INSERT INTO accounting_publications(
              id,version_id,scope_type,scope_id,fiscal_year,fiscal_month,status,created_by
            ) VALUES('manual',?,'store','store-a',2026,6,'published','admin')""", (a.id,))

    def test_provenance_is_complete_and_amount_is_omitted(self):
        version = self.create()
        data = self.workflow.provenance("fact-" + version.id, ACCOUNTING)
        for key in ("fact_id","raw_value_id","version_id","source_file_id","file_hash","batch_id","source_sheet","source_cell_reference","source_row","source_column_label","source_account_name"):
            self.assertIn(key, data)
        self.assertNotIn("amount_net", data)


if __name__ == "__main__":
    unittest.main()

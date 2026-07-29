from __future__ import annotations

import json
import sqlite3
import uuid
from dataclasses import dataclass

from .auth import AuthorizationError, require_role, require_scope
from .domain import ActorContext, ActorRole


class WorkflowError(RuntimeError):
    pass


def _id() -> str:
    return str(uuid.uuid4())


@dataclass(frozen=True)
class VersionRef:
    id: str
    label: str


class AccountingWorkflow:
    def __init__(self, connection: sqlite3.Connection):
        self.db = connection
        self.db.row_factory = sqlite3.Row

    def _audit(self, actor: ActorContext, action: str, target: str, result: str, reason: str, metadata=None) -> None:
        self.db.execute(
            "INSERT INTO accounting_audit_logs(id,actor_id,action,target_type,target_id,result,reason,metadata_json) VALUES(?,?,?,?,?,?,?,?)",
            (_id(), actor.actor_id, action, "version", target, result, reason, json.dumps(metadata or {}, separators=(",", ":"))),
        )

    def create_version(
        self, import_file_id: str, fiscal_year: int, fiscal_month: int,
        scope_type: str, scope_id: str, version_type: str, actor: ActorContext,
        prior_version_id: str | None = None, supersedes_version_id: str | None = None,
        restore_source_version_id: str | None = None,
    ) -> VersionRef:
        require_role(actor, ActorRole.ACCOUNTING_ADMIN)
        require_scope(actor, scope_type, scope_id)
        number = self.db.execute(
            "SELECT COALESCE(MAX(version_number),0)+1 FROM accounting_versions WHERE scope_type=? AND scope_id=? AND fiscal_year=? AND fiscal_month=?",
            (scope_type, scope_id, fiscal_year, fiscal_month),
        ).fetchone()[0]
        kind = {"draft": "DRAFT", "revision": "REV", "final": "FINAL", "rollback_restore": "ROLLBACK"}[version_type]
        label = f"{fiscal_year:04d}-{fiscal_month:02d}-{kind}-{number:02d}"
        version_id = _id()
        with self.db:
            self.db.execute(
                """INSERT INTO accounting_versions(
                  id,version_number,version_label,fiscal_year,fiscal_month,version_type,
                  scope_type,scope_id,prior_version_id,supersedes_version_id,
                  restore_source_version_id,import_file_id,status,created_by
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (version_id, number, label, fiscal_year, fiscal_month, version_type,
                 scope_type, scope_id, prior_version_id, supersedes_version_id,
                 restore_source_version_id, import_file_id, "imported", actor.actor_id),
            )
            self._audit(actor, "version_created", version_id, "success", "new immutable version")
        return VersionRef(version_id, label)

    def validate_version(self, version_id: str, actor: ActorContext) -> None:
        require_role(actor, ActorRole.ACCOUNTING_ADMIN, ActorRole.ACCOUNTING_REVIEWER)
        version = self._version(version_id)
        require_scope(actor, version["scope_type"], version["scope_id"])
        blocking = self.db.execute(
            "SELECT COUNT(*) FROM accounting_validation_results WHERE version_id=? AND severity='blocking'",
            (version_id,),
        ).fetchone()[0]
        if blocking:
            raise WorkflowError("blocking validations remain")
        with self.db:
            cursor = self.db.execute("UPDATE accounting_versions SET status='validated' WHERE id=? AND status='imported'", (version_id,))
            if cursor.rowcount != 1:
                raise WorkflowError("version is not imported")
            self._audit(actor, "validated", version_id, "success", "blocking validation count is zero")

    def approve(self, version_id: str, stage: str, decision: str, reason: str, actor: ActorContext) -> None:
        if not reason.strip():
            raise WorkflowError("approval or rejection reason is required")
        version = self._version(version_id)
        require_scope(actor, version["scope_type"], version["scope_id"])
        if stage == "accounting":
            require_role(actor, ActorRole.ACCOUNTING_REVIEWER)
            expected = "validated"
            next_status = "accounting_approved" if decision == "approved" else "accounting_rejected"
        elif stage == "management":
            require_role(actor, ActorRole.MANAGEMENT_APPROVER)
            expected = "accounting_approved"
            next_status = "management_approved" if decision == "approved" else "management_rejected"
        else:
            raise WorkflowError("unknown approval stage")
        with self.db:
            cursor = self.db.execute(
                "UPDATE accounting_versions SET status=? WHERE id=? AND status=?",
                (next_status, version_id, expected),
            )
            if cursor.rowcount != 1:
                raise WorkflowError(f"{stage} decision is invalid from current state")
            self.db.execute(
                "INSERT INTO accounting_approvals(id,version_id,approval_stage,decision,reason,actor_id) VALUES(?,?,?,?,?,?)",
                (_id(), version_id, stage, decision, reason, actor.actor_id),
            )
            self._audit(actor, f"{stage}_{decision}", version_id, "success", reason)

    def publish(self, version_id: str, actor: ActorContext) -> str:
        require_role(actor, ActorRole.ACCOUNTING_ADMIN)
        version = self._version(version_id)
        require_scope(actor, version["scope_type"], version["scope_id"])
        self._assert_publishable(version)
        publication_id = _id()
        with self.db:
            active = self.db.execute(
                """SELECT p.id,p.version_id FROM accounting_publications p
                   WHERE scope_type=? AND scope_id=? AND fiscal_year=? AND fiscal_month=? AND status='published'""",
                (version["scope_type"], version["scope_id"], version["fiscal_year"], version["fiscal_month"]),
            ).fetchone()
            if active and version["supersedes_version_id"] != active["version_id"]:
                raise WorkflowError("active publication conflict requires explicit supersedes_version_id")
            if active:
                self.db.execute("UPDATE accounting_publications SET status='superseded' WHERE id=?", (active["id"],))
                self.db.execute("UPDATE accounting_versions SET status='superseded' WHERE id=?", (active["version_id"],))
            self.db.execute("UPDATE accounting_versions SET status='published' WHERE id=?", (version_id,))
            self.db.execute("UPDATE accounting_facts SET status='published' WHERE version_id=?", (version_id,))
            self.db.execute(
                """INSERT INTO accounting_publications(
                   id,version_id,scope_type,scope_id,fiscal_year,fiscal_month,status,
                   supersedes_publication_id,created_by) VALUES(?,?,?,?,?,?,?,?,?)""",
                (publication_id, version_id, version["scope_type"], version["scope_id"],
                 version["fiscal_year"], version["fiscal_month"], "published",
                 active["id"] if active else None, actor.actor_id),
            )
            self._audit(actor, "published", version_id, "success", "explicit publication",
                        {"superseded_version_id": active["version_id"] if active else None})
        return publication_id

    def rollback(
        self, bad_version_id: str, restore_version_id: str,
        accounting_actor: ActorContext, management_actor: ActorContext,
        publisher: ActorContext, reason: str,
    ) -> VersionRef:
        bad = self._version(bad_version_id)
        restore = self._version(restore_version_id)
        for actor in (accounting_actor, management_actor, publisher):
            require_scope(actor, bad["scope_type"], bad["scope_id"])
        if bad["status"] != "published" or restore["status"] != "superseded":
            raise WorkflowError("rollback requires published bad version and superseded restore source")
        new = self.create_version(
            restore["import_file_id"], bad["fiscal_year"], bad["fiscal_month"],
            bad["scope_type"], bad["scope_id"], "rollback_restore", publisher,
            prior_version_id=bad_version_id, supersedes_version_id=bad_version_id,
            restore_source_version_id=restore_version_id,
        )
        with self.db:
            rows = self.db.execute("SELECT * FROM accounting_facts WHERE version_id=?", (restore_version_id,)).fetchall()
            for fact in rows:
                self.db.execute(
                    """INSERT INTO accounting_facts(
                    id,raw_value_id,version_id,source_file_id,normalized_account,entity_id,
                    scope_type,scope_id,period,amount_net,amount_tax,amount_gross,tax_basis,status
                    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (_id(), fact["raw_value_id"], new.id, fact["source_file_id"],
                     fact["normalized_account"], fact["entity_id"], fact["scope_type"],
                     fact["scope_id"], fact["period"], fact["amount_net"], fact["amount_tax"],
                     fact["amount_gross"], fact["tax_basis"], "validated"),
                )
            self.db.execute("UPDATE accounting_versions SET status='validated' WHERE id=?", (new.id,))
        self.approve(new.id, "accounting", "approved", reason, accounting_actor)
        self.approve(new.id, "management", "approved", reason, management_actor)
        self.publish(new.id, publisher)
        with self.db:
            self._audit(publisher, "rollback", new.id, "success", reason,
                        {"bad_version_id": bad_version_id, "restore_source_version_id": restore_version_id})
        return new

    def consumer_facts(self, actor: ActorContext, scope_type: str, scope_id: str) -> list[sqlite3.Row]:
        require_scope(actor, scope_type, scope_id)
        return self.db.execute(
            "SELECT * FROM accounting_consumer_facts WHERE scope_type=? AND scope_id=?",
            (scope_type, scope_id),
        ).fetchall()

    def provenance(self, fact_id: str, actor: ActorContext) -> dict[str, object]:
        row = self.db.execute(
            """SELECT f.id fact_id,f.version_id,f.raw_value_id,f.source_file_id,
            i.file_hash,i.batch_id,r.source_sheet,r.source_sheet_type,r.source_cell_reference,
            r.source_row,r.source_column_label,r.fiscal_year,r.source_account_name,
            f.scope_type,f.scope_id
            FROM accounting_facts f JOIN accounting_raw_values r ON r.id=f.raw_value_id
            JOIN accounting_import_files i ON i.id=f.source_file_id WHERE f.id=?""",
            (fact_id,),
        ).fetchone()
        if not row:
            raise WorkflowError("fact not found")
        require_scope(actor, row["scope_type"], row["scope_id"])
        return dict(row)

    def _version(self, version_id: str) -> sqlite3.Row:
        row = self.db.execute("SELECT * FROM accounting_versions WHERE id=?", (version_id,)).fetchone()
        if not row:
            raise WorkflowError("version not found")
        return row

    def _assert_publishable(self, version: sqlite3.Row) -> None:
        if version["status"] != "management_approved":
            raise WorkflowError("management approval and explicit publish are required")
        blocking = self.db.execute(
            "SELECT COUNT(*) FROM accounting_validation_results WHERE version_id=? AND severity='blocking'",
            (version["id"],),
        ).fetchone()[0]
        if blocking:
            raise WorkflowError("blocking validations remain")
        invalid_entities = self.db.execute(
            """SELECT COUNT(*) FROM accounting_facts f JOIN accounting_raw_values r ON r.id=f.raw_value_id
               LEFT JOIN accounting_entity_mappings m ON m.source_system='yayoi_excel'
                 AND m.source_entity_name=r.source_entity_name AND m.status='approved'
               WHERE f.version_id=? AND m.id IS NULL""", (version["id"],)
        ).fetchone()[0]
        invalid_accounts = self.db.execute(
            """SELECT COUNT(*) FROM accounting_facts f JOIN accounting_raw_values r ON r.id=f.raw_value_id
               LEFT JOIN accounting_account_mappings m ON m.source_system='yayoi_excel'
                 AND m.statement_type=r.statement_type AND m.source_account_name=r.source_account_name
                 AND m.normalized_account=f.normalized_account AND m.status='approved'
               WHERE f.version_id=? AND m.id IS NULL""", (version["id"],)
        ).fetchone()[0]
        if invalid_entities or invalid_accounts:
            raise WorkflowError("approved entity and account mappings are required")
        if version["fiscal_month"] < 1 or version["fiscal_month"] > 12:
            raise WorkflowError("target period is not confirmed")
        detected = self.db.execute(
            "SELECT detected_period,confirmed_through_period,publish_block_reason FROM accounting_import_files WHERE id=?",
            (version["import_file_id"],),
        ).fetchone()
        expected = f"{version['fiscal_year']:04d}-{version['fiscal_month']:02d}-01"
        if not detected or detected["detected_period"] != expected or detected["publish_block_reason"]:
            raise WorkflowError("source target period is not confirmed")
        if not detected["confirmed_through_period"] or expected > detected["confirmed_through_period"]:
            raise WorkflowError("target period is after confirmed_through_period")

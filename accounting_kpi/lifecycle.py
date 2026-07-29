from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import date, datetime, timezone

from .domain import KpiActorContext, KpiActorRole


FORMAL_KPIS = (
    "gross_profit_margin", "operating_profit_margin", "ordinary_profit_margin",
    "net_profit_margin", "equity_ratio", "current_ratio",
)


class LifecycleError(RuntimeError):
    pass


class DefinitionSetService:
    def __init__(self, db: sqlite3.Connection):
        self.db = db

    @staticmethod
    def _trusted(actor: KpiActorContext, *roles: KpiActorRole) -> None:
        if not actor.trusted_server_context:
            raise PermissionError("untrusted actor context")
        if actor.role not in roles:
            raise PermissionError("actor role denied")

    def create(self, version: str, actor: KpiActorContext, valid_from: date,
               codes: tuple[str, ...] = FORMAL_KPIS) -> str:
        self._trusted(actor, KpiActorRole.KPI_ADMIN, KpiActorRole.KPI_DEFINITION_EDITOR)
        set_id = str(uuid.uuid4())
        with self.db:
            self.db.execute(
                """INSERT INTO accounting_kpi_definition_sets(
                id,definition_set_version,status,valid_from,created_by
                ) VALUES(?,?,'proposed',?,?)""",
                (set_id, version, valid_from.isoformat(), actor.actor_id),
            )
            for code in codes:
                definition = self.db.execute(
                    "SELECT id,definition_json FROM accounting_kpi_definitions WHERE kpi_code=?",
                    (code,),
                ).fetchone()
                if not definition:
                    raise LifecycleError(f"unknown definition: {code}")
                expressions = json.loads(definition["definition_json"])
                group_codes = {expressions["numerator"]["code"], expressions["denominator"]["code"]}
                for group_code in group_codes:
                    group = self.db.execute(
                        "SELECT id FROM accounting_kpi_account_groups WHERE group_code=?",
                        (group_code,),
                    ).fetchone()
                    self.db.execute(
                        """INSERT INTO accounting_kpi_definition_set_members(
                        definition_set_id,kpi_definition_id,account_group_id) VALUES(?,?,?)""",
                        (set_id, definition["id"], group["id"]),
                    )
            self._audit(actor, "definition_set_created", set_id, "proposed definition set")
        return set_id

    def accounting_review(self, set_id: str, actor: KpiActorContext, reason: str) -> None:
        self._trusted(actor, KpiActorRole.ACCOUNTING_DEFINITION_REVIEWER)
        self._transition(set_id, "proposed", "accounting_approved", actor, reason)

    def management_approve(self, set_id: str, actor: KpiActorContext, reason: str) -> None:
        self._trusted(actor, KpiActorRole.MANAGEMENT_DEFINITION_APPROVER)
        self._transition(set_id, "accounting_approved", "management_approved", actor, reason)

    def release(self, set_id: str, actor: KpiActorContext, reason: str) -> None:
        self._trusted(actor, KpiActorRole.KPI_ADMIN)
        row = self.db.execute(
            """SELECT COUNT(*) missing FROM accounting_kpi_definition_set_members m
            LEFT JOIN accounting_kpi_definitions d ON d.id=m.kpi_definition_id
            LEFT JOIN accounting_kpi_account_groups g ON g.id=m.account_group_id
            WHERE m.definition_set_id=? AND (d.approval_status!='approved' OR g.approval_status!='approved')""",
            (set_id,),
        ).fetchone()
        if row["missing"]:
            raise LifecycleError("definition set contains unapproved definition or account group")
        self._transition(set_id, "management_approved", "released", actor, reason, release=True)

    def supersede(self, old_set_id: str, new_set_id: str, actor: KpiActorContext, reason: str) -> None:
        self._trusted(actor, KpiActorRole.KPI_ADMIN)
        if self.status(new_set_id) != "released":
            raise LifecycleError("replacement definition set must be released")
        with self.db:
            self.db.execute(
                "UPDATE accounting_kpi_definition_sets SET status='superseded' WHERE id=? AND status='released'",
                (old_set_id,),
            )
            self.db.execute(
                "UPDATE accounting_kpi_definition_sets SET supersedes_definition_set_id=? WHERE id=?",
                (old_set_id, new_set_id),
            )
            self._audit(actor, "definition_set_superseded", old_set_id, reason)

    def status(self, set_id: str) -> str:
        row = self.db.execute("SELECT status FROM accounting_kpi_definition_sets WHERE id=?", (set_id,)).fetchone()
        if not row:
            raise LifecycleError("definition set not found")
        return row["status"]

    def _transition(self, set_id: str, expected: str, target: str, actor: KpiActorContext,
                    reason: str, release: bool = False) -> None:
        now = datetime.now(timezone.utc).isoformat()
        fields = "status=?,approved_by=?,approved_at=?"
        values: list[object] = [target, actor.actor_id, now]
        if release:
            fields += ",released_by=?,released_at=?"
            values += [actor.actor_id, now]
        values += [set_id, expected]
        with self.db:
            cursor = self.db.execute(
                f"UPDATE accounting_kpi_definition_sets SET {fields} WHERE id=? AND status=?",
                values,
            )
            if cursor.rowcount != 1:
                raise LifecycleError(f"invalid transition {expected} -> {target}")
            self._audit(actor, f"definition_set_{target}", set_id, reason)

    def _audit(self, actor: KpiActorContext, action: str, target_id: str, reason: str) -> None:
        self.db.execute(
            """INSERT INTO accounting_kpi_audit_logs(
            id,actor_id,action,target_type,target_id,reason) VALUES(?,?,?,'definition_set',?,?)""",
            (str(uuid.uuid4()), actor.actor_id, action, target_id, reason),
        )

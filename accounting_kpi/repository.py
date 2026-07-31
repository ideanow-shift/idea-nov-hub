from __future__ import annotations

import json
import sqlite3
import uuid
from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path

from .domain import AccountGroup, ApprovalStatus, KpiDefinition, KpiResult


class DuplicateCompletedRun(RuntimeError):
    pass


def open_database(path: Path | str = ":memory:") -> sqlite3.Connection:
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.executescript(Path(__file__).with_name("schema.sql").read_text(encoding="utf-8"))
    return connection


class KpiRepository:
    def __init__(self, connection: sqlite3.Connection):
        self.db = connection
        self.definitions: dict[str, KpiDefinition] = {}
        self.groups: dict[str, AccountGroup] = {}
        self.last_run_reused = False

    def seed(self, definitions: list[KpiDefinition], groups: list[AccountGroup]) -> None:
        with self.db:
            for definition in definitions:
                self.definitions[definition.code] = definition
                self.db.execute(
                    """INSERT INTO accounting_kpi_definitions(
                    id,kpi_code,kpi_name,definition_version,definition_json,valid_from,valid_to,
                    approval_status,supersedes_definition_id) VALUES(?,?,?,?,?,?,?,?,?)""",
                    (definition.id, definition.code, definition.name, definition.definition_version,
                     json.dumps({"numerator": definition.numerator_expression, "denominator": definition.denominator_expression}),
                     definition.valid_from.isoformat(), definition.valid_to.isoformat() if definition.valid_to else None,
                     definition.approval_status.value, definition.supersedes_definition_id),
                )
            for group in groups:
                self.groups[group.code] = group
                self.db.execute(
                    """INSERT INTO accounting_kpi_account_groups(
                    id,group_code,definition_version,valid_from,valid_to,approval_status,supersedes_group_id
                    ) VALUES(?,?,?,?,?,?,?)""",
                    (group.id, group.code, group.definition_version, group.valid_from.isoformat(),
                     group.valid_to.isoformat() if group.valid_to else None,
                     group.approval_status.value, group.supersedes_group_id),
                )
                for member in group.canonical_account_members:
                    self.db.execute(
                        """INSERT INTO accounting_kpi_account_group_members(
                        id,account_group_id,canonical_account,effective_from,effective_to
                        ) VALUES(?,?,?,?,?)""",
                        (str(uuid.uuid4()), group.id, member, group.member_effective_from.isoformat(),
                         group.member_effective_to.isoformat() if group.member_effective_to else None),
                    )

    def approve_definition(self, code: str, actor_id: str) -> KpiDefinition:
        now = datetime.now(timezone.utc)
        current = self.definitions[code]
        approved = replace(current, approval_status=ApprovalStatus.APPROVED, approved_by=actor_id, approved_at=now)
        with self.db:
            self.db.execute(
                "UPDATE accounting_kpi_definitions SET approval_status='approved',approved_by=?,approved_at=? WHERE id=?",
                (actor_id, now.isoformat(), current.id),
            )
            self._audit(actor_id, "definition_approved", "definition", current.id, "explicit prototype approval")
        self.definitions[code] = approved
        return approved

    def approve_group(self, code: str, actor_id: str) -> AccountGroup:
        now = datetime.now(timezone.utc)
        current = self.groups[code]
        approved = replace(current, approval_status=ApprovalStatus.APPROVED, approved_by=actor_id, approved_at=now)
        with self.db:
            self.db.execute(
                "UPDATE accounting_kpi_account_groups SET approval_status='approved',approved_by=?,approved_at=? WHERE id=?",
                (actor_id, now.isoformat(), current.id),
            )
            self._audit(actor_id, "account_group_approved", "account_group", current.id, "explicit prototype approval")
        self.groups[code] = approved
        return approved

    def supersede_definition(
        self, code: str, replacement: KpiDefinition, actor_id: str, reason: str
    ) -> KpiDefinition:
        current = self.definitions[code]
        if replacement.code != code or replacement.supersedes_definition_id != current.id:
            raise ValueError("replacement must retain code and reference superseded definition")
        if replacement.definition_version <= current.definition_version:
            raise ValueError("replacement definition version must increase")
        with self.db:
            self.db.execute(
                "UPDATE accounting_kpi_definitions SET approval_status='inactive',updated_at=CURRENT_TIMESTAMP WHERE id=?",
                (current.id,),
            )
            self.db.execute(
                """INSERT INTO accounting_kpi_definitions(
                id,kpi_code,kpi_name,definition_version,definition_json,valid_from,valid_to,
                approval_status,supersedes_definition_id) VALUES(?,?,?,?,?,?,?,?,?)""",
                (replacement.id, replacement.code, replacement.name, replacement.definition_version,
                 json.dumps({"numerator": replacement.numerator_expression,
                             "denominator": replacement.denominator_expression}),
                 replacement.valid_from.isoformat(),
                 replacement.valid_to.isoformat() if replacement.valid_to else None,
                 replacement.approval_status.value, replacement.supersedes_definition_id),
            )
            self._audit(actor_id, "definition_superseded", "definition", current.id, reason)
        self.definitions[code] = replacement
        return replacement

    def create_run(
        self, accounting_version_id: str, entity_id: str, scope_type: str, period: str,
        actor_id: str, definition_set_version: str = "phase4-v1", amount_basis: str = "net",
        recalculate: bool = False, retry_of_run_id: str | None = None,
    ) -> str:
        self.last_run_reused = False
        existing = self.db.execute(
            """SELECT id FROM accounting_kpi_calculation_runs
            WHERE accounting_version_id=? AND definition_set_version=? AND entity_id=?
            AND scope_type=? AND target_period=? AND amount_basis=?
            AND status IN ('completed','completed_with_warnings')""",
            (accounting_version_id, definition_set_version, entity_id, scope_type, period, amount_basis),
        ).fetchone()
        if existing and not recalculate:
            self.last_run_reused = True
            return existing["id"]
        if existing and recalculate:
            self.supersede_run(existing["id"], actor_id, "explicit recalculation")
        run_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        attempt = 1
        if retry_of_run_id:
            prior = self.db.execute(
                "SELECT status,attempt_number FROM accounting_kpi_calculation_runs WHERE id=?",
                (retry_of_run_id,),
            ).fetchone()
            if not prior or prior["status"] != "failed":
                raise ValueError("retry requires a failed run")
            attempt = prior["attempt_number"] + 1
        try:
            with self.db:
                self.db.execute(
                    """INSERT INTO accounting_kpi_calculation_runs(
                    id,accounting_version_id,entity_id,scope_type,target_period,definition_set_version,
                    amount_basis,status,started_at,triggered_by,retry_of_run_id,attempt_number
                    ) VALUES(?,?,?,?,?,?,?,'running',?,?,?,?)""",
                    (run_id, accounting_version_id, entity_id, scope_type, period,
                     definition_set_version, amount_basis, now, actor_id, retry_of_run_id, attempt),
                )
        except sqlite3.IntegrityError as error:
            raise DuplicateCompletedRun("concurrent duplicate calculation run") from error
        return run_id

    def supersede_run(self, run_id: str, actor_id: str, reason: str) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self.db:
            self.db.execute(
                "UPDATE accounting_kpi_calculation_runs SET status='superseded',superseded_at=? WHERE id=?",
                (now, run_id),
            )
            self.db.execute(
                """UPDATE accounting_kpi_results SET superseded_at=?
                WHERE calculation_run_id=? AND superseded_at IS NULL""",
                (now, run_id),
            )
            self._audit(actor_id, "run_superseded", "calculation_run", run_id, reason)

    def observe_accounting_version(self, version_id: str, active_published: bool = True) -> None:
        with self.db:
            self.db.execute(
                """INSERT INTO accounting_kpi_accounting_version_projection(
                accounting_version_id,active_published) VALUES(?,?)
                ON CONFLICT(accounting_version_id) DO UPDATE SET
                active_published=excluded.active_published,observed_at=CURRENT_TIMESTAMP""",
                (version_id, int(active_published)),
            )

    def deactivate_accounting_version(self, version_id: str, actor_id: str, reason: str) -> None:
        self.observe_accounting_version(version_id, False)
        runs = self.db.execute(
            """SELECT id FROM accounting_kpi_calculation_runs
            WHERE accounting_version_id=? AND status IN ('completed','completed_with_warnings')""",
            (version_id,),
        ).fetchall()
        for run in runs:
            self.supersede_run(run["id"], actor_id, reason)

    def save_result(self, result: KpiResult) -> None:
        with self.db:
            self.db.execute(
                """INSERT INTO accounting_kpi_results(
                id,calculation_run_id,kpi_definition_id,kpi_code,definition_version,
                accounting_version_id,entity_id,scope_type,period,value,unit,data_state,
                reason_code,missing_components_json,numerator_value,denominator_value,calculated_at
                ) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? FROM accounting_kpi_definitions WHERE id=?""",
                (result.id, result.calculation_run_id, result.definition_id,
                 next(code for code, definition in self.definitions.items() if definition.id == result.definition_id),
                 result.definition_version, result.accounting_version_id, result.entity_id,
                 result.scope_type, result.period.isoformat(),
                 str(result.value) if result.value is not None else None, result.unit,
                 result.data_state.value, result.reason_code,
                 json.dumps(result.missing_components),
                 str(result.numerator_value) if result.numerator_value is not None else None,
                 str(result.denominator_value) if result.denominator_value is not None else None,
                 result.calculated_at.isoformat(), result.definition_id),
            )
            for role, identifiers in (
                ("numerator", result.numerator_fact_ids),
                ("denominator", result.denominator_fact_ids),
            ):
                for fact_id in identifiers:
                    group_code = (
                        self.definitions[next(code for code, definition in self.definitions.items() if definition.id == result.definition_id)]
                        .numerator_expression["code"] if role == "numerator"
                        else self.definitions[next(code for code, definition in self.definitions.items() if definition.id == result.definition_id)]
                        .denominator_expression["code"]
                    )
                    self.db.execute(
                        """INSERT INTO accounting_kpi_result_inputs(
                        id,kpi_result_id,input_role,account_group_id,accounting_fact_id,
                        accounting_version_id,source_scope) VALUES(?,?,?,?,?,?,?)""",
                        (str(uuid.uuid4()), result.id, role, self.groups[group_code].id,
                         fact_id, result.accounting_version_id, result.scope_type),
                    )

    def complete_run(self, run_id: str) -> None:
        with self.db:
            self.db.execute(
                "UPDATE accounting_kpi_calculation_runs SET status='completed',completed_at=? WHERE id=?",
                (datetime.now(timezone.utc).isoformat(), run_id),
            )

    def provenance(self, result_id: str) -> list[sqlite3.Row]:
        return self.db.execute(
            """SELECT r.id kpi_result_id,r.kpi_definition_id,r.definition_version,
            r.calculation_run_id,r.accounting_version_id,i.input_role,i.account_group_id,
            i.accounting_fact_id,i.source_scope
            FROM accounting_kpi_results r JOIN accounting_kpi_result_inputs i
            ON i.kpi_result_id=r.id WHERE r.id=? ORDER BY i.input_role,i.accounting_fact_id""",
            (result_id,),
        ).fetchall()

    def _audit(self, actor_id: str, action: str, target_type: str, target_id: str, reason: str) -> None:
        self.db.execute(
            "INSERT INTO accounting_kpi_audit_logs(id,actor_id,action,target_type,target_id,reason) VALUES(?,?,?,?,?,?)",
            (str(uuid.uuid4()), actor_id, action, target_type, target_id, reason),
        )

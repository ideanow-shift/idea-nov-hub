from __future__ import annotations

import json
import sqlite3
import uuid
from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path

from .domain import AccountGroup, ApprovalStatus, KpiDefinition, KpiResult


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

    def create_run(self, accounting_version_id: str, entity_id: str, scope_type: str, period: str, actor_id: str) -> str:
        run_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        self.db.execute(
            """INSERT INTO accounting_kpi_calculation_runs(
            id,accounting_version_id,entity_id,scope_type,target_period,definition_set_version,
            status,started_at,triggered_by) VALUES(?,?,?,?,?,?,'running',?,?)""",
            (run_id, accounting_version_id, entity_id, scope_type, period, "phase4-v1", now, actor_id),
        )
        return run_id

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

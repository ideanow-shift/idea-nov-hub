from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from .domain import KpiActorContext, KpiActorRole, KpiScopeType


STORE_KPIS = frozenset({
    "gross_profit_margin", "operating_profit_margin", "ordinary_profit_margin",
})
GENERAL_ROLES = frozenset({
    KpiActorRole.EXECUTIVE_VIEWER, KpiActorRole.DEPARTMENT_MANAGER,
    KpiActorRole.STORE_MANAGER, KpiActorRole.FRANCHISE_OWNER,
})
ADMIN_ROLES = frozenset({
    KpiActorRole.KPI_ADMIN, KpiActorRole.ACCOUNTING_DEFINITION_REVIEWER,
    KpiActorRole.MANAGEMENT_DEFINITION_APPROVER,
})


class ConsumerAccessError(PermissionError):
    pass


def _authorize(actor: KpiActorContext, scope_type: str, entity_id: str) -> None:
    if not actor.trusted_server_context:
        raise ConsumerAccessError("untrusted actor context")
    if actor.role is KpiActorRole.EMPLOYEE or actor.scope_type is KpiScopeType.NONE:
        raise ConsumerAccessError("KPI access denied")
    if actor.role in ADMIN_ROLES or (
        actor.role is KpiActorRole.EXECUTIVE_VIEWER and actor.scope_type is KpiScopeType.ALL_GROUP
    ):
        return
    if actor.scope_type.value != scope_type or entity_id not in actor.scope_ids:
        raise ConsumerAccessError("actor scope denied")
    if actor.role is KpiActorRole.STORE_MANAGER and scope_type != "store":
        raise ConsumerAccessError("store manager scope denied")
    if actor.role is KpiActorRole.FRANCHISE_OWNER and scope_type not in {"store", "franchise_company", "legal_entity"}:
        raise ConsumerAccessError("franchise owner scope denied")


def display_percent(value: Decimal) -> Decimal:
    return (value * Decimal("100")).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)


class ConsumerProjection:
    def __init__(self, db: sqlite3.Connection):
        self.db = db

    def get(self, actor: KpiActorContext, entity_id: str, scope_type: str, period: str,
            *, body_claims: dict[str, str] | None = None) -> dict[str, object]:
        _authorize(actor, scope_type, entity_id)
        # Body claims are deliberately ignored; routing uses trusted path/session context.
        rows = self.db.execute(
            """SELECT r.*,run.definition_set_version,run.status run_status,run.completed_at,
            ds.status definition_set_status,d.approval_status definition_status
            FROM accounting_kpi_results r
            JOIN accounting_kpi_calculation_runs run ON run.id=r.calculation_run_id
            JOIN accounting_kpi_definition_sets ds
              ON ds.definition_set_version=run.definition_set_version
            JOIN accounting_kpi_accounting_version_projection av
              ON av.accounting_version_id=run.accounting_version_id
            JOIN accounting_kpi_definitions d ON d.id=r.kpi_definition_id
            WHERE r.entity_id=? AND r.scope_type=? AND r.period=?
              AND run.status IN ('completed','completed_with_warnings')
              AND ds.status='released' AND d.approval_status='approved'
              AND av.active_published=1
              AND r.superseded_at IS NULL
              AND r.data_state='available'
            ORDER BY r.kpi_code""",
            (entity_id, scope_type, period),
        ).fetchall()
        if actor.role is KpiActorRole.STORE_MANAGER:
            rows = [row for row in rows if row["kpi_code"] in STORE_KPIS]
        if not rows:
            raise LookupError("no active consumer KPI result")
        kpis = []
        for row in rows:
            value = Decimal(row["value"])
            item = {
                "kpi_code": row["kpi_code"],
                "kpi_name": row["kpi_code"],
                "value": float(value),
                "display_value": float(display_percent(value)) if row["unit"] == "percent" else float(value),
                "unit": row["unit"],
                "display_scale": 1,
                "data_state": row["data_state"],
                "reason_code": row["reason_code"],
                "definition_version": row["definition_version"],
                "calculated_at": row["calculated_at"],
            }
            kpis.append(item)
        first = rows[0]
        return {
            "entity_id": entity_id,
            "scope_type": scope_type,
            "period": period,
            "period_mode": "monthly",
            "accounting_version_id": first["accounting_version_id"],
            "definition_set_version": first["definition_set_version"],
            "calculation_run_id": first["calculation_run_id"],
            "last_published_at": first["completed_at"] or datetime.now(timezone.utc).isoformat(),
            "overall_data_state": "available",
            "kpis": kpis,
        }

    def admin_provenance(self, actor: KpiActorContext, result_id: str) -> list[dict[str, object]]:
        if not actor.trusted_server_context or actor.role not in ADMIN_ROLES:
            raise ConsumerAccessError("provenance access denied")
        rows = self.db.execute(
            """SELECT i.* FROM accounting_kpi_result_inputs i
            JOIN accounting_kpi_results r ON r.id=i.kpi_result_id
            WHERE i.kpi_result_id=?""",
            (result_id,),
        ).fetchall()
        return [dict(row) for row in rows]


def corporate_api(projection: ConsumerProjection, actor: KpiActorContext, entity_id: str,
                  scope_type: str, period: str) -> dict[str, object]:
    if actor.role not in ADMIN_ROLES | {KpiActorRole.EXECUTIVE_VIEWER, KpiActorRole.DEPARTMENT_MANAGER}:
        raise ConsumerAccessError("corporate KPI API denied")
    return projection.get(actor, entity_id, scope_type, period)


def store_api(projection: ConsumerProjection, actor: KpiActorContext, store_id: str,
              period: str, body_claims: dict[str, str] | None = None) -> dict[str, object]:
    if actor.role is not KpiActorRole.STORE_MANAGER:
        raise ConsumerAccessError("store KPI API denied")
    return projection.get(actor, store_id, "store", period, body_claims=body_claims)

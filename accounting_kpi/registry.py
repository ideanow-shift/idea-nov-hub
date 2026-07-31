from __future__ import annotations

import json
from datetime import date
from pathlib import Path

from .domain import AccountGroup, ApprovalStatus, KpiDefinition


def load_definitions(path: Path) -> list[KpiDefinition]:
    document = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(document, dict):
        defaults = document["defaults"]
        rows = [{**defaults, **row} for row in document["definitions"]]
    else:
        rows = document
    return [
        KpiDefinition(
            id=row["kpi_definition_id"],
            code=row["kpi_code"],
            name=row["kpi_name"],
            description=row["description"],
            category=row["category"],
            applicable_scopes=tuple(row["applicable_scope"]),
            numerator_expression=row["numerator_expression"],
            denominator_expression=row["denominator_expression"],
            required_account_groups=tuple(row["required_account_groups"]),
            statement_type=row["statement_type"],
            period_mode=row["period_mode"],
            amount_basis=row["amount_basis"],
            unit=row["unit"],
            rounding_rule=row["rounding_rule"],
            zero_denominator_rule=row["zero_denominator_rule"],
            negative_denominator_rule=row["negative_denominator_rule"],
            missing_component_rule=row["missing_component_rule"],
            valid_from=date.fromisoformat(row["valid_from"]),
            valid_to=date.fromisoformat(row["valid_to"]) if row.get("valid_to") else None,
            definition_version=row["definition_version"],
            approval_status=ApprovalStatus(row["approval_status"]),
            supersedes_definition_id=row.get("supersedes_definition_id"),
        )
        for row in rows
    ]


def load_account_groups(path: Path) -> list[AccountGroup]:
    document = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(document, dict):
        defaults = document["defaults"]
        rows = [{**defaults, **row} for row in document["groups"]]
    else:
        rows = document
    return [
        AccountGroup(
            id=row["group_id"],
            code=row["group_code"],
            definition_version=row["definition_version"],
            valid_from=date.fromisoformat(row["valid_from"]),
            valid_to=date.fromisoformat(row["valid_to"]) if row.get("valid_to") else None,
            approval_status=ApprovalStatus(row["approval_status"]),
            canonical_account_members=tuple(row["canonical_account_members"]),
            member_effective_from=date.fromisoformat(row["member_effective_from"]),
            member_effective_to=date.fromisoformat(row["member_effective_to"]) if row.get("member_effective_to") else None,
            supersedes_group_id=row.get("supersedes_group_id"),
        )
        for row in rows
    ]

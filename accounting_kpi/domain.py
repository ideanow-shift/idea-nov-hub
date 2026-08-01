from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any


class ApprovalStatus(StrEnum):
    DRAFT = "draft"
    PROPOSED = "proposed"
    APPROVED = "approved"
    REJECTED = "rejected"
    INACTIVE = "inactive"


class DataState(StrEnum):
    AVAILABLE = "available"
    COLLECTING = "collecting"
    PREPARING = "preparing"
    UNAVAILABLE = "unavailable"
    VALIDATION_ERROR = "validation_error"


class DefinitionSetStatus(StrEnum):
    DRAFT = "draft"
    PROPOSED = "proposed"
    ACCOUNTING_APPROVED = "accounting_approved"
    MANAGEMENT_APPROVED = "management_approved"
    RELEASED = "released"
    SUPERSEDED = "superseded"
    REJECTED = "rejected"
    INACTIVE = "inactive"


class RunStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    COMPLETED_WITH_WARNINGS = "completed_with_warnings"
    FAILED = "failed"
    SUPERSEDED = "superseded"
    CANCELLED = "cancelled"


class KpiActorRole(StrEnum):
    KPI_ADMIN = "kpi_admin"
    KPI_DEFINITION_EDITOR = "kpi_definition_editor"
    ACCOUNTING_DEFINITION_REVIEWER = "accounting_definition_reviewer"
    MANAGEMENT_DEFINITION_APPROVER = "management_definition_approver"
    EXECUTIVE_VIEWER = "executive_viewer"
    DEPARTMENT_MANAGER = "department_manager"
    STORE_MANAGER = "store_manager"
    FRANCHISE_OWNER = "franchise_owner"
    EMPLOYEE = "employee"


class KpiScopeType(StrEnum):
    ALL_GROUP = "all_group"
    LEGAL_ENTITY = "legal_entity"
    DEPARTMENT = "department"
    STORE = "store"
    FRANCHISE_COMPANY = "franchise_company"
    NONE = "none"


@dataclass(frozen=True)
class KpiActorContext:
    actor_id: str
    role: KpiActorRole
    scope_type: KpiScopeType
    scope_ids: frozenset[str]
    trusted_server_context: bool = True


@dataclass(frozen=True)
class KpiDefinition:
    id: str
    code: str
    name: str
    description: str
    category: str
    applicable_scopes: tuple[str, ...]
    numerator_expression: dict[str, Any]
    denominator_expression: dict[str, Any]
    required_account_groups: tuple[str, ...]
    statement_type: str
    period_mode: str
    amount_basis: str
    unit: str
    rounding_rule: dict[str, Any]
    zero_denominator_rule: str
    negative_denominator_rule: str
    missing_component_rule: str
    valid_from: date
    valid_to: date | None
    definition_version: int
    approval_status: ApprovalStatus
    approved_by: str | None = None
    approved_at: datetime | None = None
    supersedes_definition_id: str | None = None


@dataclass(frozen=True)
class AccountGroup:
    id: str
    code: str
    definition_version: int
    valid_from: date
    valid_to: date | None
    approval_status: ApprovalStatus
    canonical_account_members: tuple[str, ...]
    member_effective_from: date
    member_effective_to: date | None
    approved_by: str | None = None
    approved_at: datetime | None = None
    supersedes_group_id: str | None = None


@dataclass(frozen=True)
class CoreFact:
    id: str
    accounting_version_id: str
    entity_id: str
    scope_type: str
    period: date
    canonical_account: str
    amount: Decimal
    amount_basis: str
    version_status: str = "published"
    accounting_approved: bool = True
    management_approved: bool = True
    confirmed_through_period: date | None = None
    closing_status: str = "confirmed"
    carry_forward: bool = False
    active_projection: bool = True
    source_sheet: str = "masked"
    source_cell: str = "masked"


@dataclass(frozen=True)
class KpiResult:
    id: str
    calculation_run_id: str
    definition_id: str
    definition_version: int
    accounting_version_id: str
    entity_id: str
    scope_type: str
    period: date
    value: Decimal | None
    unit: str
    data_state: DataState
    reason_code: str | None
    missing_components: tuple[str, ...]
    numerator_value: Decimal | None
    denominator_value: Decimal | None
    numerator_fact_ids: tuple[str, ...]
    denominator_fact_ids: tuple[str, ...]
    calculated_at: datetime

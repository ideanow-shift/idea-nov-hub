from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from enum import StrEnum


class StatementType(StrEnum):
    BS = "bs"
    PL = "pl"


class ValueState(StrEnum):
    AMOUNT = "amount"
    ZERO = "zero"
    BLANK = "blank"
    TEXT = "text"
    FORMULA = "formula"
    ERROR = "error"


class MappingStatus(StrEnum):
    UNMAPPED = "unmapped"
    PROPOSED = "proposed"
    APPROVED = "approved"
    REJECTED = "rejected"
    INACTIVE = "inactive"


class Severity(StrEnum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    BLOCKING = "blocking"


class ScopeType(StrEnum):
    LEAF_STORE = "leaf_store"
    DEPARTMENT_SUMMARY = "department_summary"
    FRANCHISE_SUMMARY = "franchise_summary"
    LEGAL_ENTITY_SUMMARY = "legal_entity_summary"
    CONSOLIDATED_SUMMARY = "consolidated_summary"
    UNKNOWN = "unknown"


@dataclass(frozen=True)
class RawValue:
    source_sheet: str
    source_row: int
    source_column: int
    source_column_label: str
    detected_period: date | None
    statement_type: StatementType
    source_entity_name: str
    scope_type: ScopeType
    section: str | None
    source_account_name: str
    parent_context: str | None
    occurrence_context: str
    value_state: ValueState
    amount_net: Decimal | None
    formula: str | None = None


@dataclass(frozen=True)
class CanonicalFact:
    raw: RawValue
    normalized_account: str | None
    entity_id: str | None
    account_mapping_status: MappingStatus
    entity_mapping_status: MappingStatus
    period_type: str
    tax_basis: str = "tax_exclusive"
    amount_tax: Decimal | None = None
    amount_gross: Decimal | None = None
    data_state: str = "preparing"

    @property
    def publishable(self) -> bool:
        return (
            self.raw.detected_period is not None
            and self.raw.amount_net is not None
            and self.entity_mapping_status is MappingStatus.APPROVED
            and self.account_mapping_status is MappingStatus.APPROVED
        )


@dataclass(frozen=True)
class ValidationResult:
    code: str
    severity: Severity
    source_sheet: str | None
    message: str

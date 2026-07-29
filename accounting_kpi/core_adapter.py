from __future__ import annotations

from datetime import date

from .domain import CoreFact


class CoreProjectionError(RuntimeError):
    pass


class PublishedCoreProjection:
    """Read-only adapter over Accounting Core's active consumer projection."""

    def __init__(self, facts: list[CoreFact]):
        self._facts = tuple(facts)

    def facts_for(
        self,
        accounting_version_id: str,
        entity_id: str,
        scope_type: str,
        period: date,
    ) -> list[CoreFact]:
        candidates = [
            fact for fact in self._facts
            if fact.accounting_version_id == accounting_version_id
            and fact.entity_id == entity_id
            and fact.scope_type == scope_type
            and fact.period == period
        ]
        if not candidates:
            raise CoreProjectionError("MISSING_ACCOUNTING_DATA")
        if any(fact.version_status != "published" for fact in candidates):
            raise CoreProjectionError("ACCOUNTING_VERSION_NOT_PUBLISHED")
        if any(not fact.accounting_approved or not fact.management_approved for fact in candidates):
            raise CoreProjectionError("ACCOUNTING_APPROVAL_REQUIRED")
        if any(not fact.active_projection for fact in candidates):
            raise CoreProjectionError("ACCOUNTING_VERSION_NOT_ACTIVE")
        if any(fact.confirmed_through_period is None or period > fact.confirmed_through_period for fact in candidates):
            raise CoreProjectionError("PERIOD_NOT_CONFIRMED")
        if any(fact.closing_status != "confirmed" or fact.carry_forward for fact in candidates):
            raise CoreProjectionError("PERIOD_NOT_CONFIRMED")
        return candidates

    def update_fact(self, *_args, **_kwargs) -> None:
        raise PermissionError("KPI Engine cannot mutate Accounting Core facts")

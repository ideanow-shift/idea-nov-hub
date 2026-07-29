from __future__ import annotations

from datetime import date

from .domain import CanonicalFact, RawValue
from .mapping import CsvMappingReader


def normalize(
    raw: RawValue,
    mappings: CsvMappingReader,
    confirmed_through_period: date | None = None,
) -> CanonicalFact:
    entity = mappings.resolve_entity(raw.source_entity_name)
    account = mappings.resolve_account(raw)
    label = raw.source_column_label
    period_type = (
        "period_activity" if raw.statement_type.value == "pl"
        else "period_end_balance"
    )
    if any(word in label for word in ("上半期", "下半期", "累計", "残高", "決算")):
        period_type = "source_cumulative_reconciliation"
    period_confirmed = bool(
        raw.detected_period
        and confirmed_through_period
        and raw.detected_period <= confirmed_through_period
    )
    return CanonicalFact(
        raw=raw,
        normalized_account=account.target,
        entity_id=entity.target,
        account_mapping_status=account.status,
        entity_mapping_status=entity.status,
        period_type=period_type,
        data_state="available" if period_confirmed else "preparing",
        closing_status="confirmed" if period_confirmed else "pending",
        publish_allowed=period_confirmed,
    )

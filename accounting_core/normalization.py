from __future__ import annotations

from .domain import CanonicalFact, RawValue
from .mapping import CsvMappingReader


def normalize(raw: RawValue, mappings: CsvMappingReader) -> CanonicalFact:
    entity = mappings.resolve_entity(raw.source_entity_name)
    account = mappings.resolve_account(raw)
    label = raw.source_column_label
    period_type = (
        "period_activity" if raw.statement_type.value == "pl"
        else "period_end_balance"
    )
    if any(word in label for word in ("上半期", "下半期", "累計", "残高", "決算")):
        period_type = "source_cumulative_reconciliation"
    return CanonicalFact(
        raw=raw,
        normalized_account=account.target,
        entity_id=entity.target,
        account_mapping_status=account.status,
        entity_mapping_status=entity.status,
        period_type=period_type,
    )

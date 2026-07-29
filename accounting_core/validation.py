from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Iterable

from .domain import CanonicalFact, MappingStatus, RawValue, Severity, StatementType, ValidationResult


PL_EQUATIONS = {
    "PL_GROSS_PROFIT_MISMATCH": ("売上総損益金額", (("売上高合計", 1), ("売上原価", -1))),
    "PL_OPERATING_PROFIT_MISMATCH": ("営業損益金額", (("売上総損益金額", 1), ("販売管理費計", -1))),
    "PL_ORDINARY_PROFIT_MISMATCH": ("経常損益金額", (("営業損益金額", 1), ("営業外収益合計", 1), ("営業外費用合計", -1))),
    "PL_PRETAX_PROFIT_MISMATCH": ("税引前当期純損益金額", (("経常損益金額", 1), ("特別利益合計", 1), ("特別損失合計", -1))),
    "PL_NET_PROFIT_MISMATCH": ("当期純損益金額", (("税引前当期純損益金額", 1), ("法人税等", -1))),
}


def validate_raw(values: Iterable[RawValue]) -> list[ValidationResult]:
    rows = list(values)
    results: list[ValidationResult] = []
    by_cell = {(r.source_sheet, r.source_account_name, r.source_column_label): r for r in rows}
    sheets = sorted({r.source_sheet for r in rows})
    for sheet in sheets:
        sample = next(r for r in rows if r.source_sheet == sheet)
        if sample.statement_type is StatementType.BS:
            for label in sorted({r.source_column_label for r in rows if r.source_sheet == sheet}):
                a = by_cell.get((sheet, "資産合計", label))
                b = by_cell.get((sheet, "負債･純資産合計", label))
                if a and b and a.amount_net is not None and b.amount_net is not None and a.amount_net != b.amount_net:
                    results.append(ValidationResult("BS_OUT_OF_BALANCE", Severity.BLOCKING, sheet, "B/S balance mismatch"))
        else:
            labels = sorted({r.source_column_label for r in rows if r.source_sheet == sheet})
            for code, (target, components) in PL_EQUATIONS.items():
                for label in labels:
                    expected = by_cell.get((sheet, target, label))
                    parts = [by_cell.get((sheet, name, label)) for name, _ in components]
                    if expected and expected.amount_net is not None and all(p and p.amount_net is not None for p in parts):
                        calculated = sum((p.amount_net * Decimal(multiplier) for p, (_, multiplier) in zip(parts, components)), Decimal())
                        if abs(expected.amount_net - calculated) > Decimal("0.5"):
                            results.append(ValidationResult(code, Severity.BLOCKING, sheet, "P/L equation mismatch"))
        june = {r.source_account_name: r.amount_net for r in rows if r.source_sheet == sheet and r.detected_period and r.detected_period.month == 6}
        july = {r.source_account_name: r.amount_net for r in rows if r.source_sheet == sheet and r.detected_period and r.detected_period.month == 7}
        if june and june == july:
            results.append(ValidationResult("DUPLICATE_PERIOD_WARNING", Severity.WARNING, sheet, "June and July values are identical"))
            results.append(ValidationResult("PERIOD_NOT_CONFIRMED", Severity.BLOCKING, sheet, "Detected period cannot be published without confirmation"))
    return results


def validate_mappings(facts: Iterable[CanonicalFact]) -> list[ValidationResult]:
    results: list[ValidationResult] = []
    seen: set[tuple[str, str | None, str | None, str, str | None]] = set()
    emitted: set[tuple[str, str]] = set()
    for fact in facts:
        raw = fact.raw
        if fact.entity_mapping_status is not MappingStatus.APPROVED:
            key = ("ENTITY_MAPPING_NOT_APPROVED", raw.source_sheet)
            if key not in emitted:
                emitted.add(key)
                results.append(ValidationResult(key[0], Severity.BLOCKING, raw.source_sheet, "Entity mapping is not approved"))
        if fact.account_mapping_status is not MappingStatus.APPROVED:
            key = ("ACCOUNT_MAPPING_NOT_APPROVED", raw.source_sheet)
            if key not in emitted:
                emitted.add(key)
                results.append(ValidationResult(key[0], Severity.BLOCKING, raw.source_sheet, "Account mapping is not approved"))
        # A duplicate canonical fact can only be asserted after both period and
        # account identity are resolved. Source cumulative/closing columns have
        # no monthly period and must not be reported as duplicate month facts.
        if raw.detected_period is not None and fact.normalized_account is not None:
            unique_key = (
                raw.source_entity_name,
                raw.detected_period.isoformat(),
                fact.normalized_account,
                raw.statement_type.value,
                raw.occurrence_context,
            )
            if unique_key in seen:
                results.append(ValidationResult("DUPLICATE_FACT", Severity.BLOCKING, raw.source_sheet, "Duplicate canonical fact key"))
            seen.add(unique_key)
    return results

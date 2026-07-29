from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from pathlib import Path

from .domain import RawValue, Severity
from .validation import PL_EQUATIONS, validate_raw
from .yayoi_excel import YayoiExcelAdapter, file_hash


@dataclass(frozen=True)
class YearAudit:
    label: str
    hash_prefix: str
    sheet_count: int
    entity_names: frozenset[str]
    account_keys: frozenset[tuple[str, str, str, str]]
    raw_count: int
    period_min: str
    period_max: str
    statement_sheet_counts: dict[str, int]
    row_shapes: dict[str, tuple[int, ...]]
    validation_counts: dict[str, int]
    blocking_codes: tuple[str, ...]
    accounting_check_count: int


def audit_year(year_label: str, path: Path) -> YearAudit:
    adapter = YayoiExcelAdapter(path)
    row_shapes: dict[str, set[int]] = {"bs": set(), "pl": set()}
    statement_sheets: Counter[str] = Counter()
    for name in adapter.workbook.sheetnames:
        statement = "bs" if name.startswith("貸･") else "pl" if name.startswith("損･") else "unknown"
        statement_sheets[statement] += 1
        row_shapes.setdefault(statement, set()).add(adapter.workbook[name].max_row)
    raw = list(adapter.extract())
    adapter.close()
    validations = validate_raw(raw)
    by_cell = {(r.source_sheet, r.source_account_name, r.source_column_label): r for r in raw}
    accounting_check_count = 0
    for sheet in {r.source_sheet for r in raw}:
        sample = next(r for r in raw if r.source_sheet == sheet)
        labels = {r.source_column_label for r in raw if r.source_sheet == sheet}
        if sample.statement_type.value == "bs":
            for column_label in labels:
                left = by_cell.get((sheet, "資産合計", column_label))
                right = by_cell.get((sheet, "負債･純資産合計", column_label))
                accounting_check_count += int(bool(left and right and left.amount_net is not None and right.amount_net is not None))
        else:
            for target, components in PL_EQUATIONS.values():
                for column_label in labels:
                    expected = by_cell.get((sheet, target, column_label))
                    parts = [by_cell.get((sheet, name, column_label)) for name, _ in components]
                    accounting_check_count += int(bool(
                        expected and expected.amount_net is not None
                        and all(part and part.amount_net is not None for part in parts)
                    ))
    periods = sorted({value.detected_period.isoformat() for value in raw if value.detected_period})
    account_keys = frozenset(
        (
            value.statement_type.value,
            value.section or "",
            value.source_account_name,
            value.occurrence_context,
        )
        for value in raw
    )
    return YearAudit(
        label=year_label,
        hash_prefix=file_hash(path)[:8],
        sheet_count=len({value.source_sheet for value in raw}),
        entity_names=frozenset(value.source_entity_name for value in raw),
        account_keys=account_keys,
        raw_count=len(raw),
        period_min=periods[0],
        period_max=periods[-1],
        statement_sheet_counts=dict(statement_sheets),
        row_shapes={key: tuple(sorted(values)) for key, values in row_shapes.items()},
        validation_counts=dict(Counter(result.severity.value for result in validations)),
        blocking_codes=tuple(sorted({result.code for result in validations if result.severity is Severity.BLOCKING})),
        accounting_check_count=accounting_check_count,
    )


def compare_years(audits: list[YearAudit]) -> dict[str, object]:
    comparisons = []
    for previous, current in zip(audits, audits[1:]):
        comparisons.append({
            "from": previous.label,
            "to": current.label,
            "entities_added": sorted(current.entity_names - previous.entity_names),
            "entities_removed": sorted(previous.entity_names - current.entity_names),
            "account_keys_added": sorted(current.account_keys - previous.account_keys),
            "account_keys_removed": sorted(previous.account_keys - current.account_keys),
        })
    return {
        "years": [
            {
                "label": audit.label,
                "hash_prefix": audit.hash_prefix,
                "sheet_count": audit.sheet_count,
                "entity_count": len(audit.entity_names),
                "account_key_count": len(audit.account_keys),
                "raw_count": audit.raw_count,
                "period_min": audit.period_min,
                "period_max": audit.period_max,
                "statement_sheet_counts": audit.statement_sheet_counts,
                "row_shapes": audit.row_shapes,
                "validation_counts": audit.validation_counts,
                "blocking_codes": audit.blocking_codes,
                "accounting_check_count": audit.accounting_check_count,
            }
            for audit in audits
        ],
        "comparisons": comparisons,
    }

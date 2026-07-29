from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path

from .domain import MappingStatus, RawValue


@dataclass(frozen=True)
class MappingResolution:
    target: str | None
    status: MappingStatus


def _status(value: str) -> MappingStatus:
    return MappingStatus.APPROVED if value.strip().lower() == "approved" else MappingStatus.PROPOSED


class CsvMappingReader:
    def __init__(self, entity_csv: Path, account_csv: Path, alias_csv: Path | None = None):
        with entity_csv.open(encoding="utf-8-sig", newline="") as source:
            self.entities = {row["弥生会計上の名称"]: row for row in csv.DictReader(source)}
        with account_csv.open(encoding="utf-8-sig", newline="") as source:
            self.accounts = list(csv.DictReader(source))
        alias_path = alias_csv or account_csv.with_name("yayoi-account-aliases.csv")
        if alias_path.exists():
            with alias_path.open(encoding="utf-8-sig", newline="") as source:
                self.aliases = list(csv.DictReader(source))
        else:
            self.aliases = []

    def resolve_entity(self, source_name: str) -> MappingResolution:
        row = self.entities.get(source_name)
        if not row:
            return MappingResolution(None, MappingStatus.UNMAPPED)
        target = row.get("対応ID候補")
        return MappingResolution(
            None if target in ("", "Unknown", "該当なし") else target,
            _status(row.get("mapping_status", "")),
        )

    def resolve_account(self, raw: RawValue) -> MappingResolution:
        fiscal_start = f"{raw.fiscal_year:04d}-09-01"
        alias = next(
            (
                row for row in self.aliases
                if row["statement_type"].lower() == raw.statement_type.value
                and row["section"] == (raw.section or "")
                and row["source_alias"] == raw.source_account_name
                and (not row["effective_from"] or row["effective_from"] <= fiscal_start)
                and (not row["effective_to"] or fiscal_start <= row["effective_to"])
            ),
            None,
        )
        source_name = alias["canonical_source_name"] if alias else raw.source_account_name
        candidates = [
            row for row in self.accounts
            if row["元科目名"] == source_name
            and row["B/S・P/L"].lower() == raw.statement_type.value
        ]
        if len(candidates) != 1:
            return MappingResolution(None, MappingStatus.UNMAPPED)
        row = candidates[0]
        # Existing CSV has no approved state and names alone cannot approve.
        return MappingResolution(row["正規化カテゴリ"], MappingStatus.PROPOSED)

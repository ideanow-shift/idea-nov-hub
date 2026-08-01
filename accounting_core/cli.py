from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path


def _db(path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    return connection


def report(connection: sqlite3.Connection, version_id: str) -> dict[str, object]:
    version = connection.execute(
        """SELECT v.*,i.batch_id,i.confirmed_through_period FROM accounting_versions v
           JOIN accounting_import_files i ON i.id=v.import_file_id WHERE v.id=?""",
        (version_id,),
    ).fetchone()
    if not version:
        raise SystemExit("version not found")
    scalar = lambda sql, args=(version_id,): connection.execute(sql, args).fetchone()[0]
    accounting = connection.execute(
        "SELECT decision FROM accounting_approvals WHERE version_id=? AND approval_stage='accounting' ORDER BY created_at DESC LIMIT 1",
        (version_id,),
    ).fetchone()
    management = connection.execute(
        "SELECT decision FROM accounting_approvals WHERE version_id=? AND approval_stage='management' ORDER BY created_at DESC LIMIT 1",
        (version_id,),
    ).fetchone()
    published = scalar("SELECT COUNT(*) FROM accounting_publications WHERE version_id=? AND status='published'")
    return {
        "batch_id": version["batch_id"],
        "version_id": version_id,
        "version_label": version["version_label"],
        "target_period": f"{version['fiscal_year']:04d}-{version['fiscal_month']:02d}",
        "confirmed_through_period": version["confirmed_through_period"],
        "entity_count": scalar("SELECT COUNT(DISTINCT entity_id) FROM accounting_facts WHERE version_id=?"),
        "raw_value_count": scalar("""SELECT COUNT(DISTINCT raw_value_id) FROM accounting_facts WHERE version_id=?"""),
        "canonical_fact_count": scalar("SELECT COUNT(*) FROM accounting_facts WHERE version_id=?"),
        "blocking_count": scalar("SELECT COUNT(*) FROM accounting_validation_results WHERE version_id=? AND severity='blocking'"),
        "warning_count": scalar("SELECT COUNT(*) FROM accounting_validation_results WHERE version_id=? AND severity='warning'"),
        "entity_mapping_unapproved_count": scalar("""SELECT COUNT(DISTINCT r.source_entity_name)
          FROM accounting_facts f JOIN accounting_raw_values r ON r.id=f.raw_value_id
          LEFT JOIN accounting_entity_mappings m ON m.source_entity_name=r.source_entity_name AND m.status='approved'
          WHERE f.version_id=? AND m.id IS NULL"""),
        "account_mapping_unapproved_count": scalar("""SELECT COUNT(DISTINCT r.source_account_name)
          FROM accounting_facts f JOIN accounting_raw_values r ON r.id=f.raw_value_id
          LEFT JOIN accounting_account_mappings m ON m.statement_type=r.statement_type
            AND m.source_account_name=r.source_account_name AND m.normalized_account=f.normalized_account
            AND m.status='approved' WHERE f.version_id=? AND m.id IS NULL"""),
        "accounting_approval": accounting[0] if accounting else "pending",
        "management_approval": management[0] if management else "pending",
        "publishable": version["status"] == "management_approved",
        "published_fact_count": scalar("SELECT COUNT(*) FROM accounting_consumer_facts WHERE version_id=?"),
        "superseded_version": version["supersedes_version_id"],
        "rollback_possible_version": version["restore_source_version_id"] or version["prior_version_id"],
        "consumer_projection_count": scalar("SELECT COUNT(*) FROM accounting_consumer_facts WHERE version_id=?"),
        "closing_status": (
            "confirmed"
            if version["confirmed_through_period"]
            and f"{version['fiscal_year']:04d}-{version['fiscal_month']:02d}-01" <= version["confirmed_through_period"]
            else "pending"
        ),
        "data_state": "available" if published else "preparing",
    }


def provenance(connection: sqlite3.Connection, fact_id: str) -> dict[str, object]:
    row = connection.execute(
        """SELECT f.id fact_id,f.version_id,f.raw_value_id,f.source_file_id,
        i.file_hash,i.batch_id,r.source_sheet,r.source_sheet_type,r.source_cell_reference,
        r.source_row,r.source_column_label,r.fiscal_year,r.source_account_name
        FROM accounting_facts f JOIN accounting_raw_values r ON r.id=f.raw_value_id
        JOIN accounting_import_files i ON i.id=f.source_file_id WHERE f.id=?""",
        (fact_id,),
    ).fetchone()
    if not row:
        raise SystemExit("fact not found")
    return dict(row)


def main() -> None:
    parser = argparse.ArgumentParser(description="Accounting Core metadata-only report")
    parser.add_argument("--database", required=True, type=Path)
    sub = parser.add_subparsers(dest="command", required=True)
    report_parser = sub.add_parser("report")
    report_parser.add_argument("--version-id", required=True)
    provenance_parser = sub.add_parser("provenance")
    provenance_parser.add_argument("--fact-id", required=True)
    args = parser.parse_args()
    connection = _db(args.database)
    result = report(connection, args.version_id) if args.command == "report" else provenance(connection, args.fact_id)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

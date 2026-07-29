from __future__ import annotations

import sqlite3


def metadata_report(db: sqlite3.Connection, run_id: str) -> dict[str, object]:
    run = db.execute(
        """SELECT id,accounting_version_id,definition_set_version,entity_id,scope_type,
        target_period,amount_basis,status,attempt_number,retry_of_run_id,started_at,completed_at
        FROM accounting_kpi_calculation_runs WHERE id=?""",
        (run_id,),
    ).fetchone()
    if not run:
        raise LookupError("run not found")
    counts = db.execute(
        """SELECT COUNT(*) result_count,
        SUM(CASE WHEN data_state='available' THEN 1 ELSE 0 END) available_count
        FROM accounting_kpi_results WHERE calculation_run_id=?""",
        (run_id,),
    ).fetchone()
    return {**dict(run), **dict(counts)}

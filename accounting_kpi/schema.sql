PRAGMA foreign_keys = ON;

CREATE TABLE accounting_kpi_definitions (
  id TEXT PRIMARY KEY, kpi_code TEXT NOT NULL, kpi_name TEXT NOT NULL,
  definition_version INTEGER NOT NULL, definition_json TEXT NOT NULL,
  valid_from TEXT NOT NULL, valid_to TEXT,
  approval_status TEXT NOT NULL CHECK(approval_status IN ('draft','proposed','approved','rejected','inactive')),
  approved_by TEXT, approved_at TEXT, supersedes_definition_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(kpi_code,definition_version)
);
CREATE TABLE accounting_kpi_account_groups (
  id TEXT PRIMARY KEY, group_code TEXT NOT NULL, definition_version INTEGER NOT NULL,
  valid_from TEXT NOT NULL, valid_to TEXT,
  approval_status TEXT NOT NULL CHECK(approval_status IN ('draft','proposed','approved','rejected','inactive')),
  approved_by TEXT, approved_at TEXT, supersedes_group_id TEXT,
  UNIQUE(group_code,definition_version)
);
CREATE TABLE accounting_kpi_account_group_members (
  id TEXT PRIMARY KEY, account_group_id TEXT NOT NULL REFERENCES accounting_kpi_account_groups(id),
  canonical_account TEXT NOT NULL, effective_from TEXT NOT NULL, effective_to TEXT,
  UNIQUE(account_group_id,canonical_account,effective_from)
);
CREATE TABLE accounting_kpi_calculation_runs (
  id TEXT PRIMARY KEY, accounting_version_id TEXT NOT NULL, entity_id TEXT NOT NULL,
  scope_type TEXT NOT NULL, target_period TEXT NOT NULL,
  definition_set_version TEXT NOT NULL, status TEXT NOT NULL,
  started_at TEXT NOT NULL, completed_at TEXT, triggered_by TEXT NOT NULL,
  failure_reason TEXT
);
CREATE TABLE accounting_kpi_results (
  id TEXT PRIMARY KEY, calculation_run_id TEXT NOT NULL REFERENCES accounting_kpi_calculation_runs(id),
  kpi_definition_id TEXT NOT NULL REFERENCES accounting_kpi_definitions(id),
  kpi_code TEXT NOT NULL, definition_version INTEGER NOT NULL,
  accounting_version_id TEXT NOT NULL, entity_id TEXT NOT NULL, scope_type TEXT NOT NULL,
  period TEXT NOT NULL, value TEXT, unit TEXT NOT NULL, data_state TEXT NOT NULL,
  reason_code TEXT, missing_components_json TEXT NOT NULL DEFAULT '[]',
  numerator_value TEXT, denominator_value TEXT, calculated_at TEXT NOT NULL,
  UNIQUE(calculation_run_id,kpi_code)
);
CREATE TABLE accounting_kpi_result_inputs (
  id TEXT PRIMARY KEY, kpi_result_id TEXT NOT NULL REFERENCES accounting_kpi_results(id),
  input_role TEXT NOT NULL CHECK(input_role IN ('numerator','denominator','supporting')),
  account_group_id TEXT NOT NULL REFERENCES accounting_kpi_account_groups(id),
  accounting_fact_id TEXT NOT NULL, accounting_version_id TEXT NOT NULL,
  source_scope TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE accounting_kpi_validation_results (
  id TEXT PRIMARY KEY, calculation_run_id TEXT NOT NULL REFERENCES accounting_kpi_calculation_runs(id),
  kpi_code TEXT, severity TEXT NOT NULL, reason_code TEXT NOT NULL,
  message TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE accounting_kpi_audit_logs (
  id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, action TEXT NOT NULL,
  target_type TEXT NOT NULL, target_id TEXT NOT NULL, reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER kpi_audit_append_only_update BEFORE UPDATE ON accounting_kpi_audit_logs
BEGIN SELECT RAISE(ABORT,'KPI audit is append-only'); END;
CREATE TRIGGER kpi_audit_append_only_delete BEFORE DELETE ON accounting_kpi_audit_logs
BEGIN SELECT RAISE(ABORT,'KPI audit is append-only'); END;

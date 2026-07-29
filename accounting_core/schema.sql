PRAGMA foreign_keys = ON;

CREATE TABLE accounting_import_batches (
  id TEXT PRIMARY KEY, source_system TEXT NOT NULL, status TEXT NOT NULL,
  created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE accounting_import_files (
  id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES accounting_import_batches(id),
  source_system TEXT NOT NULL, file_hash TEXT NOT NULL, original_file_name TEXT NOT NULL,
  detected_period TEXT, duplicate_period_warning INTEGER NOT NULL DEFAULT 0,
  publish_block_reason TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_system, file_hash)
);
CREATE TABLE accounting_entity_mappings (
  id TEXT PRIMARY KEY, source_system TEXT NOT NULL, source_entity_name TEXT NOT NULL,
  scope_type TEXT NOT NULL, core_entity_id TEXT, status TEXT NOT NULL
    CHECK(status IN ('unmapped','proposed','approved','rejected','inactive')),
  UNIQUE(source_system, source_entity_name)
);
CREATE TABLE accounting_account_mappings (
  id TEXT PRIMARY KEY, source_system TEXT NOT NULL, statement_type TEXT NOT NULL,
  section TEXT, source_account_name TEXT NOT NULL, parent_context TEXT,
  source_sheet_type TEXT NOT NULL, occurrence_context TEXT NOT NULL,
  normalized_account TEXT, status TEXT NOT NULL
    CHECK(status IN ('unmapped','proposed','approved','rejected','inactive')),
  UNIQUE(source_system,statement_type,section,source_account_name,parent_context,source_sheet_type,occurrence_context)
);
CREATE TABLE accounting_versions (
  id TEXT PRIMARY KEY, version_number INTEGER NOT NULL, version_label TEXT NOT NULL,
  fiscal_year INTEGER NOT NULL, fiscal_month INTEGER NOT NULL,
  version_type TEXT NOT NULL CHECK(version_type IN ('draft','revision','final','rollback_restore')),
  scope_type TEXT NOT NULL, scope_id TEXT NOT NULL,
  prior_version_id TEXT REFERENCES accounting_versions(id),
  supersedes_version_id TEXT REFERENCES accounting_versions(id),
  restore_source_version_id TEXT REFERENCES accounting_versions(id),
  import_file_id TEXT NOT NULL REFERENCES accounting_import_files(id),
  status TEXT NOT NULL CHECK(status IN (
    'imported','validated','accounting_approved','management_approved',
    'accounting_rejected','management_rejected','published','superseded')),
  created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(scope_type,scope_id,fiscal_year,fiscal_month,version_number),
  UNIQUE(version_label)
);
CREATE TABLE accounting_raw_values (
  id TEXT PRIMARY KEY, import_file_id TEXT NOT NULL REFERENCES accounting_import_files(id),
  source_sheet TEXT NOT NULL, source_sheet_type TEXT NOT NULL,
  source_row INTEGER NOT NULL, source_column INTEGER NOT NULL,
  source_cell_reference TEXT NOT NULL, source_column_label TEXT NOT NULL,
  detected_period TEXT, source_value_state TEXT NOT NULL,
  statement_type TEXT NOT NULL, source_entity_name TEXT NOT NULL, scope_type TEXT NOT NULL,
  source_account_name TEXT NOT NULL, amount_net TEXT, formula TEXT,
  UNIQUE(import_file_id,source_sheet,source_row,source_column)
);
CREATE TABLE accounting_facts (
  id TEXT PRIMARY KEY, raw_value_id TEXT NOT NULL REFERENCES accounting_raw_values(id),
  version_id TEXT NOT NULL REFERENCES accounting_versions(id),
  source_file_id TEXT NOT NULL REFERENCES accounting_import_files(id),
  normalized_account TEXT NOT NULL, entity_id TEXT NOT NULL,
  scope_type TEXT NOT NULL, scope_id TEXT NOT NULL,
  period TEXT NOT NULL, amount_net TEXT NOT NULL, amount_tax TEXT, amount_gross TEXT,
  tax_basis TEXT NOT NULL, status TEXT NOT NULL,
  UNIQUE(version_id,entity_id,period,normalized_account,raw_value_id)
);
CREATE TABLE accounting_validation_results (
  id TEXT PRIMARY KEY, import_file_id TEXT NOT NULL REFERENCES accounting_import_files(id),
  version_id TEXT REFERENCES accounting_versions(id), code TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('info','warning','error','blocking')),
  source_sheet TEXT, raw_value_id TEXT REFERENCES accounting_raw_values(id),
  masked_message TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE accounting_approvals (
  id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES accounting_versions(id),
  approval_stage TEXT NOT NULL CHECK(approval_stage IN ('accounting','management')),
  decision TEXT NOT NULL CHECK(decision IN ('approved','rejected')),
  reason TEXT NOT NULL, actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE accounting_publications (
  id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES accounting_versions(id),
  scope_type TEXT NOT NULL, scope_id TEXT NOT NULL,
  fiscal_year INTEGER NOT NULL, fiscal_month INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('published','superseded','rolled_back')),
  supersedes_publication_id TEXT REFERENCES accounting_publications(id),
  created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX accounting_one_active_publication
  ON accounting_publications(scope_type,scope_id,fiscal_year,fiscal_month)
  WHERE status='published';
CREATE TABLE accounting_audit_logs (
  id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, action TEXT NOT NULL,
  target_type TEXT NOT NULL, target_id TEXT NOT NULL, result TEXT NOT NULL,
  reason TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE VIEW accounting_consumer_facts AS
SELECT f.*, p.created_at AS last_published_at
FROM accounting_facts f
JOIN accounting_versions v ON v.id=f.version_id AND v.status='published'
JOIN accounting_publications p ON p.version_id=v.id AND p.status='published'
WHERE f.status='published';

CREATE TRIGGER accounting_facts_no_published_update
BEFORE UPDATE ON accounting_facts WHEN OLD.status='published'
BEGIN SELECT RAISE(ABORT,'published facts are immutable'); END;
CREATE TRIGGER accounting_facts_no_published_delete
BEFORE DELETE ON accounting_facts WHEN OLD.status='published'
BEGIN SELECT RAISE(ABORT,'published facts are immutable'); END;
CREATE TRIGGER accounting_approvals_append_only_update
BEFORE UPDATE ON accounting_approvals BEGIN SELECT RAISE(ABORT,'approvals are append-only'); END;
CREATE TRIGGER accounting_approvals_append_only_delete
BEFORE DELETE ON accounting_approvals BEGIN SELECT RAISE(ABORT,'approvals are append-only'); END;
CREATE TRIGGER accounting_audit_append_only_update
BEFORE UPDATE ON accounting_audit_logs BEGIN SELECT RAISE(ABORT,'audit logs are append-only'); END;
CREATE TRIGGER accounting_audit_append_only_delete
BEFORE DELETE ON accounting_audit_logs BEGIN SELECT RAISE(ABORT,'audit logs are append-only'); END;

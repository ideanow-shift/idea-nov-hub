PRAGMA foreign_keys = ON;

CREATE TABLE accounting_import_batches (
  id TEXT PRIMARY KEY, source_system TEXT NOT NULL, status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE accounting_import_files (
  id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES accounting_import_batches(id),
  source_system TEXT NOT NULL, file_hash TEXT NOT NULL, original_file_name TEXT NOT NULL, detected_period TEXT,
  duplicate_period_warning INTEGER NOT NULL DEFAULT 0,
  publish_block_reason TEXT, UNIQUE(source_system, file_hash)
);
CREATE TABLE accounting_entity_mappings (
  id TEXT PRIMARY KEY, source_system TEXT NOT NULL, source_entity_name TEXT NOT NULL,
  scope_type TEXT NOT NULL, core_entity_id TEXT, status TEXT NOT NULL,
  UNIQUE(source_system, source_entity_name)
);
CREATE TABLE accounting_account_mappings (
  id TEXT PRIMARY KEY, source_system TEXT NOT NULL, statement_type TEXT NOT NULL,
  section TEXT, source_account_name TEXT NOT NULL, parent_context TEXT,
  source_sheet_type TEXT NOT NULL, occurrence_context TEXT NOT NULL,
  normalized_account TEXT, status TEXT NOT NULL
);
CREATE TABLE accounting_versions (
  id TEXT PRIMARY KEY, entity_key TEXT NOT NULL, period TEXT NOT NULL,
  version_no INTEGER NOT NULL, status TEXT NOT NULL,
  UNIQUE(entity_key, period, version_no)
);
CREATE TABLE accounting_raw_values (
  id TEXT PRIMARY KEY, import_file_id TEXT NOT NULL REFERENCES accounting_import_files(id),
  source_sheet TEXT NOT NULL, source_row INTEGER NOT NULL, source_column INTEGER NOT NULL,
  source_column_label TEXT NOT NULL, detected_period TEXT, source_value_state TEXT NOT NULL,
  statement_type TEXT NOT NULL, source_entity_name TEXT NOT NULL, scope_type TEXT NOT NULL,
  source_account_name TEXT NOT NULL, amount_net TEXT, formula TEXT,
  UNIQUE(import_file_id, source_sheet, source_row, source_column)
);
CREATE TABLE accounting_facts (
  id TEXT PRIMARY KEY, raw_value_id TEXT NOT NULL REFERENCES accounting_raw_values(id),
  version_id TEXT NOT NULL REFERENCES accounting_versions(id), normalized_account TEXT NOT NULL,
  entity_id TEXT NOT NULL, period TEXT NOT NULL, amount_net TEXT NOT NULL,
  amount_tax TEXT, amount_gross TEXT, tax_basis TEXT NOT NULL, status TEXT NOT NULL,
  UNIQUE(entity_id, period, version_id, normalized_account, raw_value_id)
);
CREATE TABLE accounting_validation_results (
  id TEXT PRIMARY KEY, import_file_id TEXT NOT NULL REFERENCES accounting_import_files(id),
  code TEXT NOT NULL, severity TEXT NOT NULL, source_sheet TEXT, masked_message TEXT NOT NULL
);
CREATE TABLE accounting_approvals (
  id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES accounting_versions(id),
  decision TEXT NOT NULL, actor_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE accounting_publications (
  id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES accounting_versions(id),
  status TEXT NOT NULL, supersedes_publication_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE accounting_audit_logs (
  id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, action TEXT NOT NULL,
  target_type TEXT NOT NULL, target_id TEXT NOT NULL, result TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER accounting_facts_no_published_update
BEFORE UPDATE ON accounting_facts WHEN OLD.status = 'published'
BEGIN SELECT RAISE(ABORT, 'published facts are immutable'); END;
CREATE TRIGGER accounting_facts_no_published_delete
BEFORE DELETE ON accounting_facts WHEN OLD.status = 'published'
BEGIN SELECT RAISE(ABORT, 'published facts are immutable'); END;

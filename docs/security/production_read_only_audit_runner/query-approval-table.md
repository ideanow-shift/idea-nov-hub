# Core Master Query Approval Table

| Query ID | Purpose | Target | Max rows | Timeout | Output | Masking | Failure handling |
| --- | --- | --- | ---: | --- | --- | --- | --- |
| C01_TARGET_RELATIONS | Confirm five approved relations | `pg_class`, `pg_namespace` | 5 | 5 seconds | schema, relation, kind | no identifiers beyond object names | stop, rollback, close |
| C02_COLUMN_SHAPE | Confirm column shape | `information_schema.columns` | 1,000 | 5 seconds | name, type, nullability | no values/defaults | stop, rollback, close |
| C03_CONSTRAINTS | Confirm PK/FK/unique shape | `pg_constraint` | 1,000 | 5 seconds | kind, key-column count | no key values | stop, rollback, close |
| C04_INDEXES | Confirm index shape | `pg_index` | 5 | 5 seconds | index counts | no definitions | stop, rollback, close |
| C05_RLS_POLICIES | Confirm RLS and policy count | `pg_class`, `pg_policy` | 5 | 5 seconds | boolean, count | no expressions | stop, rollback, close |
| C06_GRANT_SUMMARY | Confirm grant count by privilege | `information_schema.role_table_grants` | 100 | 5 seconds | privilege, count | grantee names omitted | stop, rollback, close |
| C07_ROW_COUNTS | Confirm aggregate table counts | approved five relations | 5 | 5 seconds | relation, count | no rows | stop, rollback, close |
| C08_STATUS_COLUMN_CANDIDATES | Confirm actual status/effective-date field names | `information_schema.columns` | 100 | 5 seconds | metadata only | no status values | stop, rollback, close |
| C09_RELATION_DEPENDENCIES | Count dependent views/functions | `pg_depend` | 5 | 5 seconds | dependency counts | no bodies | stop, rollback, close |
| C10_READONLY_GUARD_VERIFICATION | Confirm transaction read-only setting | built-in setting | 1 | 5 seconds | read-only state | none | immediate rollback, close |

No query accepts parameters, arbitrary object names, or SQL text. C01-C10 are the whole execution allowance for this pack; a future active/inactive or 21st-store classification query requires a separately reviewed pack after C08 establishes actual non-personal fields.

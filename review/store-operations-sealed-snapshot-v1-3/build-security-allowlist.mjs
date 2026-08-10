import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashCanonical } from './canonicalization.mjs';
import { SECURITY_CONTRACT_VERSION } from './package-metadata.mjs';
import { FIXED_QUERY_REGISTRY } from './query-pack-registry.mjs';
import { parseSecurityAst } from './sql-security-ast.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const FUNCTION_SIGNATURES = Object.freeze({
  acldefault: ['pg_catalog.acldefault("char",oid)'],
  aclexplode: ['pg_catalog.aclexplode(aclitem[])'],
  bool_or: ['pg_catalog.bool_or(boolean)'],
  count: ['pg_catalog.count()', 'pg_catalog.count("any")'],
  current_database: ['pg_catalog.current_database()'],
  current_setting: ['pg_catalog.current_setting(text)'],
  format_type: ['pg_catalog.format_type(oid,integer)'],
  has_database_privilege: ['pg_catalog.has_database_privilege(oid,text,text)'],
  has_function_privilege: ['pg_catalog.has_function_privilege(oid,oid,text)'],
  has_schema_privilege: ['pg_catalog.has_schema_privilege(oid,oid,text)'],
  has_sequence_privilege: ['pg_catalog.has_sequence_privilege(oid,oid,text)'],
  has_table_privilege: ['pg_catalog.has_table_privilege(oid,oid,text)'],
  jsonb_agg: ['pg_catalog.jsonb_agg(anyelement)'],
  lower: ['pg_catalog.lower(text)'],
  md5: ['pg_catalog.md5(text)'],
  to_regclass: ['pg_catalog.to_regclass(text)'],
});
const OPERATOR_SIGNATURES = Object.freeze([
  'pg_catalog.!~(name,text)',
  'pg_catalog.=(boolean,boolean)',
  'pg_catalog.=("char","char")',
  'pg_catalog.=(integer,integer)',
  'pg_catalog.=(name,name)',
  'pg_catalog.=(oid,oid)',
  'pg_catalog.=(text,text)',
  'pg_catalog.<>("char","char")',
  'pg_catalog.<>(name,text)',
  'pg_catalog.<>(text,text)',
  'pg_catalog.>(smallint,integer)',
  'pg_catalog.+(integer,integer)',
  'pg_catalog.-(bigint,bigint)',
  'pg_catalog.||(anycompatiblearray,anycompatible)',
]);

const queries = FIXED_QUERY_REGISTRY.map((query) => {
  const ast = parseSecurityAst(readFileSync(join(root, query.sqlFile), 'utf8'));
  return {
    queryId: query.queryId,
    sqlSha256: query.sqlSha256,
    astSha256: ast.astSha256,
    statementType: ast.statementType,
    statementCount: ast.statementCount,
    cteNames: ast.cteNames,
    relations: ast.relations,
    columnReferences: ast.columnReferences,
    functions: ast.functions,
    operators: ast.operators,
    identifiersSha256: hashCanonical(ast.identifiers),
  };
});
const usedFunctions = [...new Set(queries.flatMap((query) => query.functions))].sort();
for (const name of usedFunctions) {
  if (!Object.hasOwn(FUNCTION_SIGNATURES, name)) throw new Error(`UNMAPPED_FUNCTION:${name}`);
}
const core = {
  contractVersion: SECURITY_CONTRACT_VERSION,
  parserContract: 'SOCE-POSTGRES-SELECT-SECURITY-AST-v1',
  globalPublicHardeningRequired: false,
  retryCount: 0,
  controlSequence: [
    'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY',
    "SET LOCAL search_path = 'pg_catalog'",
    "SET LOCAL statement_timeout = '5000ms'",
    "SET LOCAL lock_timeout = '1000ms'",
    "SET LOCAL idle_in_transaction_session_timeout = '15000ms'",
    'ROLLBACK',
    'CONNECTION_CLOSE',
  ],
  functionSignatures: Object.fromEntries(usedFunctions.map((name) => [name, FUNCTION_SIGNATURES[name]])),
  operatorSignatures: OPERATOR_SIGNATURES,
  queries,
};
const manifest = { ...core, contentSha256: hashCanonical(core) };
if (process.argv[2] !== '--write') throw new Error('WRITE_FLAG_REQUIRED');
writeFileSync(join(root, 'security-allowlist-v1.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
process.stdout.write(`${manifest.contentSha256}\n`);

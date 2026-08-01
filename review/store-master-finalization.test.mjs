import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../docs/store_master_finalization');
const csv = await readFile(resolve(root, 'store_id_mapping.csv'), 'utf8');
const final = await readFile(resolve(root, 'store_master_final.md'), 'utf8');
const scope = await readFile(resolve(root, 'store_scope_matrix.md'), 'utf8');
const api = await readFile(resolve(root, 'store_sales_api_contract.md'), 'utf8');
const rows = csv.trim().split('\n').slice(1).map((line) => line.split(','));

assert.equal(rows.length, 20);
assert.equal(new Set(rows.map((row) => row[0])).size, 20);
assert.equal(rows.filter((row) => row[4] === 'DIRECT').length, 13);
assert.equal(rows.filter((row) => row[4] === 'FC').length, 7);
assert.ok(rows.every((row) => /^[0-9a-f]{8}\.\.\.$/i.test(row[1])));
assert.ok(rows.every((row) => row[9].startsWith('APPROVED_CANONICAL_')));
assert.match(final, /CONDITIONAL PASS/);
assert.match(final, /Owner-approved finalization record/);
assert.match(final, /not yet authorized to start a production data connection/);
assert.match(scope, /currently blocked: no approved assignment source/);
assert.match(api, /No production endpoint, host, credential, deployment, or live connection information/);
assert.doesNotMatch(`${final}\n${csv}\n${scope}\n${api}`, /postgres(?:ql)?:\/\/[^\s]+/i);
process.stdout.write('RESULT store master 20 / direct 13 / FC 7 / no production connection PASS\n');

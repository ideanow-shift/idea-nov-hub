import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { QUERY_IDS } from './query-registry.mjs';

const root = resolve(import.meta.dirname, '../../docs/security/production_read_only_audit_runner');
const files = [
  'human-approval-board.md', 'human-approval-summary.md', 'query-approval-table.md',
  'role-permission-approval-table.md', 'execution-window-approval.md',
  'evidence-retention-approval.md', 'approval-record-template.md',
];
const content = Object.fromEntries(await Promise.all(files.map(async (file) => [file, await readFile(resolve(root, file), 'utf8')])));
const board = content['human-approval-board.md'];

for (const id of ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10']) {
  assert.match(board, new RegExp(`## ${id} `));
  for (const label of ['決定内容', '推奨案', '代替案', '推奨理由', '承認しない場合の影響', 'セキュリティリスク', '運用負担', '承認文', '却下文', '要修正文']) assert.match(board, new RegExp(label));
}
for (const queryId of QUERY_IDS) assert.match(content['query-approval-table.md'], new RegExp(queryId));
assert.match(content['human-approval-summary.md'], /三者承認/);
assert.match(content['role-permission-approval-table.md'], /NOBYPASSRLS/);
assert.match(content['evidence-retention-approval.md'], /実UUID/);

const combined = Object.values(content).join('\n');
assert.doesNotMatch(combined, /postgres(?:ql)?:\/\/[^\s]+/i);
assert.doesNotMatch(combined, /bearer\s+[a-z0-9._-]+/i);
assert.doesNotMatch(combined, /password\s*=\s*[^<\s]/i);
process.stdout.write('RESULT approval-board 10 decisions / 12 queries / exposure policy PASS\n');

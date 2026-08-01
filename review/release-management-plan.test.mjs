import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../docs/release_management');
const files = ['release_plan.md', 'merge_plan.md', 'deployment_plan.md', 'rollback_plan.md', 'release_definition_v2.md', 'release_checklist_v2.md', 'go_no_go_criteria.md'];
const content = Object.fromEntries(await Promise.all(files.map(async (file) => [file, await readFile(resolve(root, file), 'utf8')])));

for (const domain of ['NOV HUB', 'Store Operations', 'NOV Talent', 'Core DB', 'Accounting Core']) assert.match(content['release_plan.md'], new RegExp(domain));
for (const label of ['Release 1.0', 'Release 1.1', 'production', 'read-only']) assert.match(content['release_plan.md'], new RegExp(label, 'i'));
assert.match(content['merge_plan.md'], /No force push/);
assert.match(content['deployment_plan.md'], /Deployment is prohibited/);
assert.match(content['rollback_plan.md'], /No automatic retry/);
assert.match(content['rollback_plan.md'], /No production DML/);
assert.match(content['release_definition_v2.md'], /業務運用開始/);
for (const criterion of ['データ整合性', '業務フロー', 'UI\/UX', '実運用レビュー', '開発品質']) assert.match(content['release_definition_v2.md'], new RegExp(criterion));
assert.match(content['release_definition_v2.md'], /すべてPASS/);
assert.match(content['release_checklist_v2.md'], /RELEASE_READY.*すべて`PASS`/s);
assert.match(content['go_no_go_criteria.md'], /Talentのデータ未投入/);
assert.match(content['go_no_go_criteria.md'], /営業部レビューが未実施/);
assert.doesNotMatch(Object.values(content).join('\n'), /postgres(?:ql)?:\/\/[^\s]+/i);
process.stdout.write('RESULT release-management roadmap scope and safety boundaries PASS\n');

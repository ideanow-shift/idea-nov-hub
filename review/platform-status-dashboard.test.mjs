import assert from 'node:assert/strict';
import { PLATFORM_STATUS_SYSTEMS, STATUS } from '../portal/platform-status/status-data.mjs';
import { CHECKS, getReleaseState } from '../portal/platform-status/status-model.mjs';

assert.equal(PLATFORM_STATUS_SYSTEMS.length, 7);
assert.deepEqual(PLATFORM_STATUS_SYSTEMS.map(({ name }) => name), ['求人管理', '店舗営業管理', 'HUB', 'Core DB', 'Accounting', 'People', 'Finance']);
for (const system of PLATFORM_STATUS_SYSTEMS) {
  assert.ok(system.owner && system.detail && system.nextDecision && system.sources.length > 0);
  for (const [key] of CHECKS) assert.ok(Object.values(STATUS).includes(system.checks[key]));
  assert.notEqual(getReleaseState(system.checks), 'RELEASE_READY');
}
assert.equal(getReleaseState(Object.fromEntries(CHECKS.map(([key]) => [key, STATUS.PASS]))), 'RELEASE_READY');
assert.equal(getReleaseState({ dataIntegrity: STATUS.BLOCKED, workflow: STATUS.PASS, ux: STATUS.PASS, operationalReview: STATUS.PASS, developmentQuality: STATUS.PASS }), 'NO_GO');
process.stdout.write('RESULT platform status 7 systems / release readiness model PASS\n');

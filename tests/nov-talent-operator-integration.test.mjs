import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTalentOperatorController, OPERATOR_CONTRACT } from '../portal/talent/operator.mjs';

const baseConfig = {
  writeApiEnabled: true,
  writeApiBaseUrl: 'https://local.invalid/functions/v1/nov-talent-write-api',
};
const helper = { getSessionToken: async () => 'local-fixture-token' };
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

test('feature flag false preserves startup request0 and token0', async () => {
  let requests = 0;
  let tokens = 0;
  const controller = createTalentOperatorController({
    config: { ...baseConfig, writeApiEnabled: false },
    helper: { getSessionToken: async () => { tokens += 1; return 'never'; } },
    fetchImpl: async () => { requests += 1; throw new Error('never'); },
  });
  assert.equal(controller.enabled, false);
  assert.equal(requests, 0);
  assert.equal(tokens, 0);
});

test('exact seven metrics map to exact event codes with create request exact1', async () => {
  const expected = {
    contacts: 'CONTACT_RECORDED',
    lineRegistrations: 'LINE_REGISTERED',
    salonTours: 'SALON_TOUR_COMPLETED',
    interviews: 'INTERVIEW_COMPLETED',
    passed: 'SELECTION_PASSED',
    offers: 'OFFER_ISSUED',
    expectedJoiners: 'EXPECTED_JOIN_CONFIRMED',
  };
  assert.deepEqual(OPERATOR_CONTRACT.metricKeys, Object.keys(expected));
  for (const [metricKey, eventCode] of Object.entries(expected)) {
    const calls = [];
    const controller = createTalentOperatorController({
      config: baseConfig,
      helper,
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return jsonResponse({ ok: true, data: { applicationNo: 'NT-2026-000001', accepted: true } });
      },
    });
    const result = await controller.record({ newApplication: true, metricKey, eventAt: '2026-07-20T10:00' });
    assert.deepEqual(result, { ok: true, category: 'recorded', requestCount: 1, retryCount: 0 });
    assert.equal(calls.length, 1);
    const payload = JSON.parse(calls[0].init.body);
    assert.deepEqual(Object.keys(payload).sort(), ['eventAt', 'eventCode', 'metricKey']);
    assert.equal(payload.eventCode, eventCode);
    assert.equal(calls[0].init.method, 'POST');
  }
});

test('create keeps application number in memory and continuation sends exact payload', async () => {
  const payloads = [];
  const controller = createTalentOperatorController({
    config: baseConfig,
    helper,
    fetchImpl: async (_url, init) => {
      const payload = JSON.parse(init.body);
      payloads.push(payload);
      return payload.applicationNo
        ? jsonResponse({ ok: true, data: { accepted: true } })
        : jsonResponse({ ok: true, data: { applicationNo: 'NT-2026-000002', accepted: true } });
    },
  });
  await controller.record({ newApplication: true, metricKey: 'contacts', eventAt: '2026-07-20T10:00+09:00' });
  const result = await controller.record({ metricKey: 'interviews', eventAt: '2026-07-21T10:00+09:00' });
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(payloads[1]).sort(), ['applicationNo', 'eventAt', 'eventCode', 'metricKey']);
  assert.equal(payloads[1].applicationNo, 'NT-2026-000002');
  assert.equal(Object.hasOwn(result, 'applicationNo'), false);
});

test('invalidation validates year, code, and withdrawn metric before request', async () => {
  let requests = 0;
  const controller = createTalentOperatorController({
    config: baseConfig,
    helper,
    fetchImpl: async (_url, init) => {
      requests += 1;
      const payload = JSON.parse(init.body);
      assert.deepEqual(Object.keys(payload).sort(), ['applicationNo', 'code', 'fiscalYear', 'metricKey']);
      return jsonResponse({ ok: true, data: { invalidated: true } });
    },
  });
  assert.equal(controller.selectApplicationNo(' NT-2026-000003 '), true);
  assert.equal((await controller.invalidate({ metricKey: 'offers', fiscalYear: 2026, code: 'WITHDRAWN' })).category, 'invalid_request');
  assert.equal((await controller.invalidate({ metricKey: 'contacts', fiscalYear: 1999, code: 'CANCELLED' })).category, 'invalid_request');
  assert.equal((await controller.invalidate({ metricKey: 'expectedJoiners', fiscalYear: 2026.5, code: 'WITHDRAWN' })).category, 'invalid_request');
  assert.equal(requests, 0);
  assert.deepEqual(await controller.invalidate({ metricKey: 'expectedJoiners', fiscalYear: 2026, code: 'WITHDRAWN' }), {
    ok: true, category: 'invalidated', requestCount: 1, retryCount: 0,
  });
  assert.equal(requests, 1);
});

test('operator enforces the exact owner-attested metric and invalidation matrix', async () => {
  const allowed = {
    contacts: ['DELETED'],
    lineRegistrations: ['DELETED'],
    salonTours: ['CANCELLED', 'NO_SHOW', 'DELETED'],
    interviews: ['CANCELLED', 'NO_SHOW', 'DELETED'],
    passed: ['DELETED'],
    offers: ['DELETED'],
    expectedJoiners: ['CANCELLED', 'NO_SHOW', 'DELETED', 'WITHDRAWN'],
  };
  const codes = ['CANCELLED', 'NO_SHOW', 'DELETED', 'WITHDRAWN'];
  for (const [metricKey, permitted] of Object.entries(allowed)) {
    for (const code of codes) {
      let requests = 0;
      const controller = createTalentOperatorController({
        config: baseConfig,
        helper,
        fetchImpl: async () => { requests += 1; return jsonResponse({ ok: true, data: { invalidated: true } }); },
      });
      assert.equal(controller.selectApplicationNo('NT-2026-000010'), true);
      const result = await controller.invalidate({ metricKey, fiscalYear: 2026, code });
      assert.equal(result.ok, permitted.includes(code), `${metricKey}:${code}`);
      assert.equal(requests, permitted.includes(code) ? 1 : 0, `${metricKey}:${code}:requestCount`);
      assert.equal(result.retryCount, 0);
    }
  }
});

test('ambiguous and invalid event timestamps fail before helper or request', async () => {
  let tokens = 0;
  let requests = 0;
  const controller = createTalentOperatorController({
    config: baseConfig,
    helper: { getSessionToken: async () => { tokens += 1; return 'token'; } },
    fetchImpl: async () => { requests += 1; return jsonResponse({}); },
  });
  for (const eventAt of ['', '2026-07-20', '07/20/2026 10:00', 'not-a-date']) {
    assert.equal((await controller.record({ newApplication: true, metricKey: 'contacts', eventAt })).category, 'invalid_request');
  }
  assert.equal(tokens, 0);
  assert.equal(requests, 0);
});

test('missing helper token fails before API request', async () => {
  let requests = 0;
  const controller = createTalentOperatorController({
    config: baseConfig,
    helper: { getSessionToken: async () => null },
    fetchImpl: async () => { requests += 1; return jsonResponse({}); },
  });
  assert.deepEqual(await controller.record({ newApplication: true, metricKey: 'contacts', eventAt: '2026-07-20T10:00' }), {
    ok: false, category: 'auth_required', requestCount: 0, retryCount: 0,
  });
  assert.equal(requests, 0);
});

test('safe HTTP categories preserve exact1 and retry0 without reading error bodies', async () => {
  for (const [status, category] of [[401, 'auth_required'], [403, 'write_forbidden'], [503, 'not_ready'], [500, 'write_failed']]) {
    let requests = 0;
    let bodyReads = 0;
    const controller = createTalentOperatorController({
      config: baseConfig,
      helper,
      fetchImpl: async () => {
        requests += 1;
        return { ok: false, status, json: async () => { bodyReads += 1; return { raw: 'never' }; } };
      },
    });
    assert.deepEqual(await controller.record({ newApplication: true, metricKey: 'contacts', eventAt: '2026-07-20T10:00' }), {
      ok: false, category, requestCount: 1, retryCount: 0,
    });
    assert.equal(requests, 1);
    assert.equal(bodyReads, 0);
  }
});

test('success envelope rejects extra fields, UUID, and wrong action shape', async () => {
  const invalidBodies = [
    { ok: true, data: { applicationNo: 'NT-2026-000004', accepted: true }, meta: {} },
    { ok: true, data: { applicationNo: 'NT-2026-000004', accepted: true, id: '00000000-0000-0000-0000-000000000000' } },
    { ok: true, data: { accepted: true } },
    { ok: true, data: { applicationNo: 'bad', accepted: true } },
  ];
  for (const body of invalidBodies) {
    const controller = createTalentOperatorController({ config: baseConfig, helper, fetchImpl: async () => jsonResponse(body) });
    assert.deepEqual(await controller.record({ newApplication: true, metricKey: 'contacts', eventAt: '2026-07-20T10:00' }), {
      ok: false, category: 'invalid_response', requestCount: 1, retryCount: 0,
    });
  }
});

test('concurrent action is request0 busy while first action remains exact1', async () => {
  let release;
  let requests = 0;
  const pending = new Promise((resolve) => { release = resolve; });
  const controller = createTalentOperatorController({
    config: baseConfig,
    helper,
    fetchImpl: async () => {
      requests += 1;
      await pending;
      return jsonResponse({ ok: true, data: { applicationNo: 'NT-2026-000005', accepted: true } });
    },
  });
  const first = controller.record({ newApplication: true, metricKey: 'contacts', eventAt: '2026-07-20T10:00' });
  await Promise.resolve();
  assert.deepEqual(await controller.record({ newApplication: true, metricKey: 'contacts', eventAt: '2026-07-20T10:00' }), {
    ok: false, category: 'busy', requestCount: 0, retryCount: 0,
  });
  assert.equal(requests, 1);
  release();
  await first;
  assert.equal(requests, 1);
});

test('browser payload never asserts role, scope, actor, or application UUID', async () => {
  const calls = [];
  const controller = createTalentOperatorController({
    config: baseConfig,
    helper,
    fetchImpl: async (_url, init) => {
      calls.push(init);
      return jsonResponse({ ok: true, data: { applicationNo: 'NT-2026-000006', accepted: true } });
    },
  });
  await controller.record({ newApplication: true, metricKey: 'contacts', eventAt: '2026-07-20T10:00' });
  const payload = JSON.parse(calls[0].body);
  for (const forbidden of ['role', 'scope', 'actor', 'applicationId', 'application_id']) assert.equal(Object.hasOwn(payload, forbidden), false);
  assert.equal(OPERATOR_CONTRACT.browserRoleAssertion, false);
  assert.equal(OPERATOR_CONTRACT.applicationNoPersistence, 'memory_only');
});

test('write-enabled candidate is cache-bound, v2-only, explicit-confirmation, and persistence-free', async () => {
  const [html, app, operator, config, style] = await Promise.all(
    ['index.html', 'app.mjs', 'operator.mjs', 'runtime-config.candidate.js', 'style.css']
      .map((name) => readFile(new URL(`../portal/talent/${name}`, import.meta.url), 'utf8')),
  );
  assert.match(app, /initializeTalentOperatorPanel\(\)/);
  assert.match(app, /operator\.mjs\?v=20260720-write-enable-candidate-1/);
  assert.match(config, /nov-talent-readonly-api-v2/);
  assert.doesNotMatch(config, /nov-talent-readonly-api["']/);
  assert.match(config, /writeApiEnabled:\s*true/);
  assert.match(html, /talent-operator-panel/);
  assert.match(html, /本システム稼働開始以降の集計/);
  assert.equal((html.match(/20260720-write-enable-candidate-1/g) || []).length, 3);
  assert.doesNotMatch(html, /20260720-readonly-v2-write-candidate-1/);
  assert.match(operator, /confirmImpl\(confirmationMessage\) !== true/);
  assert.match(operator, /confirmation_required/);
  assert.match(style, /operator-confirmation-note/);
  assert.doesNotMatch(operator, /localStorage|sessionStorage|postMessage|opener|console\.|location\.|URLSearchParams/);
  assert.doesNotMatch(operator, /applicationId|application_id/);
  assert.doesNotMatch(operator, /\brole\s*:|\bscope\s*:|\bactor\s*:/);
});

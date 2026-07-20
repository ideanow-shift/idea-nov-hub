const METRIC_EVENTS = Object.freeze({
  contacts: 'CONTACT_RECORDED',
  lineRegistrations: 'LINE_REGISTERED',
  salonTours: 'SALON_TOUR_COMPLETED',
  interviews: 'INTERVIEW_COMPLETED',
  passed: 'SELECTION_PASSED',
  offers: 'OFFER_ISSUED',
  expectedJoiners: 'EXPECTED_JOIN_CONFIRMED',
});

const INVALIDATION_ALLOWLIST = Object.freeze({
  contacts: Object.freeze(['DELETED']),
  lineRegistrations: Object.freeze(['DELETED']),
  salonTours: Object.freeze(['CANCELLED', 'NO_SHOW', 'DELETED']),
  interviews: Object.freeze(['CANCELLED', 'NO_SHOW', 'DELETED']),
  passed: Object.freeze(['DELETED']),
  offers: Object.freeze(['DELETED']),
  expectedJoiners: Object.freeze(['CANCELLED', 'NO_SHOW', 'DELETED', 'WITHDRAWN']),
});
const APPLICATION_NO = /^NT-[0-9]{4}-[0-9]{6}$/;
const LOCAL_EVENT_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;
const OFFSET_EVENT_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const FISCAL_YEAR_MIN = 2000;
const FISCAL_YEAR_MAX = 2199;
const EVENT_PATH = '/api/talent/v1/events';
const INVALIDATION_PATH = '/api/talent/v1/events/invalidate';

export const OPERATOR_CONTRACT = Object.freeze({
  metricKeys: Object.freeze(Object.keys(METRIC_EVENTS)),
  requestMaxPerAction: 1,
  retryCount: 0,
  browserRoleAssertion: false,
  applicationNoPersistence: 'memory_only',
});

function safeResult(ok, category, requestCount = 0) {
  return Object.freeze({ ok, category, requestCount, retryCount: 0 });
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  return isPlainObject(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

function normalizeEventAt(value) {
  if (typeof value !== 'string') return null;
  const candidate = value.trim();
  if (!LOCAL_EVENT_AT.test(candidate) && !OFFSET_EVENT_AT.test(candidate)) return null;
  const milliseconds = Date.parse(candidate);
  if (!Number.isFinite(milliseconds)) return null;
  return new Date(milliseconds).toISOString();
}

function normalizeWriteApiBaseUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    return parsed.href.replace(/\/$/, '');
  } catch {
    return null;
  }
}

function successShapeMatches(action, body) {
  if (!hasExactKeys(body, ['ok', 'data']) || body.ok !== true || !isPlainObject(body.data)) return false;
  if (action === 'create') {
    return hasExactKeys(body.data, ['applicationNo', 'accepted'])
      && APPLICATION_NO.test(body.data.applicationNo)
      && body.data.accepted === true;
  }
  if (action === 'continue') return hasExactKeys(body.data, ['accepted']) && body.data.accepted === true;
  return hasExactKeys(body.data, ['invalidated']) && body.data.invalidated === true;
}

function failureCategory(status) {
  if (status === 401) return 'auth_required';
  if (status === 403) return 'write_forbidden';
  if (status === 503) return 'not_ready';
  return 'write_failed';
}

export function createTalentOperatorController({
  globalObject = globalThis,
  fetchImpl = globalObject.fetch,
  config = globalObject.NOV_TALENT_CONFIG,
  helper = globalObject.NovHubSession,
} = {}) {
  let applicationNo = null;
  let busy = false;
  const writeApiBaseUrl = normalizeWriteApiBaseUrl(config?.writeApiBaseUrl);
  const enabled = config?.writeApiEnabled === true
    && writeApiBaseUrl !== null
    && typeof helper?.getSessionToken === 'function'
    && typeof fetchImpl === 'function';

  const send = async (path, payload, action) => {
    if (!enabled) return safeResult(false, 'feature_disabled');
    if (busy) return safeResult(false, 'busy');
    busy = true;
    try {
      let token;
      try {
        token = await helper.getSessionToken({ audience: 'nov_hub' });
      } catch {
        return safeResult(false, 'auth_required');
      }
      if (typeof token !== 'string' || token.length === 0) return safeResult(false, 'auth_required');

      let response;
      try {
        response = await fetchImpl(`${writeApiBaseUrl}${path}`, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {
        return safeResult(false, 'write_failed', 1);
      }

      if (!response.ok) return safeResult(false, failureCategory(response.status), 1);
      const body = await response.json().catch(() => null);
      if (!successShapeMatches(action, body)) return safeResult(false, 'invalid_response', 1);
      if (action === 'create') applicationNo = body.data.applicationNo;
      return safeResult(true, action === 'invalidate' ? 'invalidated' : 'recorded', 1);
    } finally {
      busy = false;
    }
  };

  return Object.freeze({
    enabled,
    isBusy: () => busy,
    selectApplicationNo(value) {
      const candidate = typeof value === 'string' ? value.trim() : '';
      if (busy || !APPLICATION_NO.test(candidate)) return false;
      applicationNo = candidate;
      return true;
    },
    async record({ metricKey, eventAt, newApplication = false } = {}) {
      const normalizedEventAt = normalizeEventAt(eventAt);
      if (!Object.hasOwn(METRIC_EVENTS, metricKey) || normalizedEventAt === null) {
        return safeResult(false, 'invalid_request');
      }
      if (!newApplication && !APPLICATION_NO.test(applicationNo || '')) {
        return safeResult(false, 'application_required');
      }
      const payload = {
        ...(newApplication ? {} : { applicationNo }),
        metricKey,
        eventCode: METRIC_EVENTS[metricKey],
        eventAt: normalizedEventAt,
      };
      return send(EVENT_PATH, payload, newApplication ? 'create' : 'continue');
    },
    async invalidate({ metricKey, fiscalYear, code } = {}) {
      const normalizedFiscalYear = Number(fiscalYear);
      if (!APPLICATION_NO.test(applicationNo || '')
        || !Object.hasOwn(METRIC_EVENTS, metricKey)
        || !Number.isInteger(normalizedFiscalYear)
        || normalizedFiscalYear < FISCAL_YEAR_MIN
        || normalizedFiscalYear > FISCAL_YEAR_MAX
        || !INVALIDATION_ALLOWLIST[metricKey]?.includes(code)) {
        return safeResult(false, 'invalid_request');
      }
      return send(INVALIDATION_PATH, {
        applicationNo,
        metricKey,
        fiscalYear: normalizedFiscalYear,
        code,
      }, 'invalidate');
    },
  });
}

export function initializeTalentOperatorPanel({
  globalObject = globalThis,
  documentObject = globalObject.document,
  fetchImpl = globalObject.fetch,
  confirmImpl = typeof globalObject.confirm === 'function' ? globalObject.confirm.bind(globalObject) : null,
} = {}) {
  const panel = documentObject?.getElementById?.('talent-operator-panel');
  const status = documentObject?.getElementById?.('operator-status');
  if (!panel || !status) return Object.freeze({ initialized: false });
  const controller = createTalentOperatorController({ globalObject, fetchImpl });
  panel.hidden = !controller.enabled;
  if (!controller.enabled) {
    status.textContent = '入力機能は現在無効です';
    return Object.freeze({ initialized: true, enabled: false, requestCount: 0 });
  }

  const controls = [...panel.querySelectorAll('button,input,select')];
  const setBusy = (value) => {
    for (const control of controls) control.disabled = value;
    panel.setAttribute('aria-busy', String(value));
  };
  const safeMessages = Object.freeze({
    recorded: '記録しました',
    invalidated: '失効を記録しました',
    selected: '応募番号を選択しました',
    not_ready: '入力機能は準備中です',
    auth_required: '認証を確認できません',
    write_forbidden: '入力権限を確認できません',
    application_required: '応募番号を選択してください',
    invalid_request: '入力内容を確認してください',
    invalid_response: '応答を確認できません',
    confirmation_required: '確認後に操作してください',
    busy: '処理中です',
    write_failed: '操作を完了できません',
  });
  const showSafeResult = (result) => {
    status.dataset.category = result.category;
    status.dataset.requestCount = String(result.requestCount ?? 0);
    status.dataset.retryCount = '0';
    status.textContent = safeMessages[result.category] || '操作を完了できません';
  };
  const value = (id) => documentObject.getElementById(id)?.value || '';
  documentObject.getElementById('operator-select-application')?.addEventListener('click', () => {
    const input = documentObject.getElementById('operator-application-no');
    const accepted = controller.selectApplicationNo(input?.value);
    if (input) input.value = '';
    showSafeResult(safeResult(accepted, accepted ? 'selected' : 'invalid_request'));
  });
  const run = async (action, confirmationMessage) => {
    if (controller.isBusy()) return;
    if (typeof confirmImpl !== 'function' || confirmImpl(confirmationMessage) !== true) {
      showSafeResult(safeResult(false, 'confirmation_required'));
      return;
    }
    setBusy(true);
    try {
      showSafeResult(await action());
    } finally {
      setBusy(false);
    }
  };
  documentObject.getElementById('operator-create-event')?.addEventListener('click', () => run(() => controller.record({
    newApplication: true,
    metricKey: value('operator-metric'),
    eventAt: value('operator-event-at'),
  }), '新規応募と初回イベントを記録します。よろしいですか？'));
  documentObject.getElementById('operator-continue-event')?.addEventListener('click', () => run(() => controller.record({
    metricKey: value('operator-metric'),
    eventAt: value('operator-event-at'),
  }), '選択中の応募へ後続イベントを記録します。よろしいですか？'));
  documentObject.getElementById('operator-invalidate-event')?.addEventListener('click', () => run(() => controller.invalidate({
    metricKey: value('operator-metric'),
    fiscalYear: value('operator-fiscal-year'),
    code: value('operator-invalidation-code'),
  }), '選択中のイベントを失効します。よろしいですか？'));
  return Object.freeze({ initialized: true, enabled: true, requestCount: 0, controller });
}

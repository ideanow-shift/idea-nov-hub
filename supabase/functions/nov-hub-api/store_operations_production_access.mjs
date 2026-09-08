import { evaluateStoreOperationsProductionRollout, hasStoreOperationsUatMarker,
  STORE_OPERATIONS_PRODUCTION_PROJECT_REF } from './store_operations_production_rollout.mjs';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const isoDate = /^\d{4}-\d{2}-\d{2}$/u;
const modes = { executive: 'all', area_manager: 'assigned', store_manager: 'own' };
const activeEmploymentStatuses = new Set(['現職', '在籍', 'active', 'Active']);
const payloadKeys = new Set(['authType', 'selectedMonth', 'scopeMode', 'responseProfile']);
/** @type {((ids: string[]) => Promise<unknown>) | undefined} */
const optionalCanonicalPilotLoader = undefined;
function denied() { throw new Error('PRODUCTION_CANONICAL_ACCESS_DENIED'); }

export class StoreOperationsProductionRolloutDenied extends Error {
  constructor() {
    super('PRODUCTION_ROLLOUT_ACCESS_DENIED');
    this.name = 'StoreOperationsProductionRolloutDenied';
  }
}

export function isStoreOperationsProductionRolloutDenied(error) {
  return error instanceof StoreOperationsProductionRolloutDenied;
}

export function assertProductionReadPayload(payload = {}) {
  if (hasStoreOperationsUatMarker(payload) || Object.keys(payload).some(k => !payloadKeys.has(k))) denied();
  if (payload.authType !== undefined && payload.authType !== 'hub_session') denied();
}

function canonicalPilotConfigurationState(rows, configuredIds, asOfDate) {
  if (!Array.isArray(rows)) return 'malformed';
  if (rows.length > configuredIds.length) return 'malformed';
  const byId = new Map();
  for (const value of rows) {
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || !uuid.test(value.id || '') || typeof value.is_active !== 'boolean'
      || typeof value.employment_status !== 'string'
      || (value.joined_on !== null && typeof value.joined_on !== 'string')
      || (value.retired_on !== null && typeof value.retired_on !== 'string')
      || (typeof value.joined_on === 'string' && !isoDate.test(value.joined_on))
      || (typeof value.retired_on === 'string' && !isoDate.test(value.retired_on))) return 'malformed';
    const id = String(value.id).toLowerCase();
    if (byId.has(id)) return 'malformed';
    byId.set(id, value);
  }
  for (const id of configuredIds) {
    const employee = byId.get(id);
    if (!employee || employee.is_active !== true || !activeEmploymentStatuses.has(employee.employment_status)
      || (employee.joined_on !== null && employee.joined_on > asOfDate)
      || (employee.retired_on !== null && employee.retired_on <= asOfDate)) return 'invalid';
  }
  return 'valid';
}

// session must be the result of the existing server HMAC/audience/expiry verifier, not JSON from the client.
// Only a digest of that verified native HUB subject is sent to the private database contract.
export async function resolveProductionCanonicalAccess({ session, projectRef, rolloutState, ownerEmployeeId,
  realUserPilotEmployeeId1 = '', realUserPilotEmployeeId2 = '', rpc,
  loadCanonicalPilotEmployees = optionalCanonicalPilotLoader,
  now = Date.now() }) {
  if (projectRef !== STORE_OPERATIONS_PRODUCTION_PROJECT_REF || hasStoreOperationsUatMarker(session)
    || session?.authType !== 'hub_session' || session.audience !== 'nov_hub'
    || !uuid.test(session.employeeId || '') || !uuid.test(session.sessionId || '')
    || !Number.isFinite(Date.parse(session.expiresAt)) || Date.parse(session.expiresAt) <= now) denied();
  const digestBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(session.employeeId));
  const digest = Array.from(new Uint8Array(digestBytes), b => b.toString(16).padStart(2, '0')).join('');
  let result;
  try { result = await rpc('store_operations_production_access_v1', { p_subject_digest: digest }); }
  catch { denied(); } // Never echo database exceptions, subject values, or credential material.
  if (Array.isArray(result)) { if (result.length !== 1) denied(); result = result[0]; }
  const role = result?.roleKeys?.[0];
  const ids = result?.scope?.storeIds;
  const stores = result?.masters?.stores;
  if (result?.contract !== 'production_identity_access_v1' || result.employeeId !== session.employeeId
    || result.roleKeys?.length !== 1 || !Object.hasOwn(modes, role) || result.scope?.mode !== modes[role]
    || !Array.isArray(ids) || ids.length === 0 || ids.some(x => !uuid.test(x)) || new Set(ids).size !== ids.length
    || (role === 'executive' && ids.length !== 20) || (role === 'store_manager' && ids.length !== 1)
    || !Array.isArray(stores) || stores.length !== 20 || new Set(stores.map(s => s.id)).size !== 20
    || new Set(stores.map(s => s.store_id)).size !== 20
    || stores.filter(s => s.store_type === 'DIRECT').length !== 13 || stores.filter(s => s.store_type === 'FC').length !== 7
    || stores.some(s => !uuid.test(s.id) || s.is_active !== true || !s.store_name || !s.store_id || uuidLike.test(s.store_id))
    || ids.some(id => !stores.some(s => s.id === id))
    || !Array.isArray(result.masters.corporations) || !Array.isArray(result.masters.corporation_business_profiles)) denied();
  const rollout = evaluateStoreOperationsProductionRollout({ projectRef, state: rolloutState,
    ownerEmployeeId, realUserPilotEmployeeId1, realUserPilotEmployeeId2,
    employeeId: result.employeeId, session });
  if (!rollout.allowed) {
    if (rollout.code === 'PRODUCTION_ROLLOUT_DISABLED' || rollout.code === 'PRODUCTION_OWNER_PILOT_DENIED'
      || rollout.code === 'PRODUCTION_LIMITED_REAL_USER_PILOT_DENIED') {
      throw new StoreOperationsProductionRolloutDenied();
    }
    denied();
  }
  if (rollout.state === 'LIMITED_REAL_USER_PILOT') {
    if (typeof loadCanonicalPilotEmployees !== 'function') denied();
    const configuredIds = [realUserPilotEmployeeId1, realUserPilotEmployeeId2]
      .map((id) => String(id).trim().toLowerCase());
    let rows;
    try { rows = await loadCanonicalPilotEmployees(configuredIds); }
    catch { denied(); }
    const state = canonicalPilotConfigurationState(rows, configuredIds, new Date(now).toISOString().slice(0, 10));
    if (state === 'invalid') throw new StoreOperationsProductionRolloutDenied();
    if (state !== 'valid') denied();
  }
  // Internal only; the management projection is the only public serializer.
  return { employeeId: result.employeeId, roleKeys: [role], scope: { mode: modes[role], storeIds: ids }, masters: result.masters };
}

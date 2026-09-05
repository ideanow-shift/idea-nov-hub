import { evaluateStoreOperationsProductionRollout, hasStoreOperationsUatMarker,
  STORE_OPERATIONS_PRODUCTION_PROJECT_REF } from './store_operations_production_rollout.mjs';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const modes = { executive: 'all', area_manager: 'assigned', store_manager: 'own' };
const payloadKeys = new Set(['authType', 'selectedMonth', 'scopeMode', 'responseProfile']);
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

// session must be the result of the existing server HMAC/audience/expiry verifier, not JSON from the client.
// Only a digest of that verified native HUB subject is sent to the private database contract.
export async function resolveProductionCanonicalAccess({ session, projectRef, rolloutState, ownerEmployeeId, rpc, now = Date.now() }) {
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
    ownerEmployeeId, employeeId: result.employeeId, session });
  if (!rollout.allowed) {
    if (rollout.code === 'PRODUCTION_ROLLOUT_DISABLED' || rollout.code === 'PRODUCTION_OWNER_PILOT_DENIED') {
      throw new StoreOperationsProductionRolloutDenied();
    }
    denied();
  }
  // Internal only; the management projection is the only public serializer.
  return { employeeId: result.employeeId, roleKeys: [role], scope: { mode: modes[role], storeIds: ids }, masters: result.masters };
}

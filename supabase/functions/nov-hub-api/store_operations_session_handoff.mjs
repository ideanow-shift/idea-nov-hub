const CODE_PATTERN=/^[A-Za-z0-9_-]{43}$/u;
export const STORE_OPERATIONS_HANDOFF=Object.freeze({
  target:"STORE_OPERATIONS_STAGING",
  targetOrigin:"https://idea-nov-store-operations-staging-ui-787968950888.asia-northeast1.run.app",
  handoffAudience:"store_operations_staging_handoff_v1",
  sessionAudience:"store_operations_staging_v1",
  handoffTtlSeconds:60,sessionTtlSeconds:900
});
function fail(status,code,message){const e=new Error(message);e.status=status;e.code=code;throw e;}
function b64url(bytes){let value="";for(const byte of bytes)value+=String.fromCharCode(byte);return btoa(value).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");}
async function hash(value){return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(value)))));}
function code(){return b64url(crypto.getRandomValues(new Uint8Array(32)));}
export async function issueStoreOperationsHandoff(input,deps){
  const now=deps.now(); const identity=input?.hubIdentity||{}; const sourceExpiry=Date.parse(String(identity.expiresAt||""));
  if(!identity.employeeId||!identity.sessionId||!Number.isFinite(sourceExpiry)||sourceExpiry<=now)fail(401,"HUB_AUTH_REQUIRED","Active NOV HUB session required.");
  if(input.target!==STORE_OPERATIONS_HANDOFF.target||input.targetOrigin!==STORE_OPERATIONS_HANDOFF.targetOrigin)fail(403,"TARGET_MISMATCH","Store Operations target mismatch.");
  if(!/^[A-Za-z0-9_-]{22,128}$/u.test(String(input.state||"")))fail(400,"INVALID_STATE","Valid launch state required.");
  const access=await deps.resolveAccess({employeeId:identity.employeeId,effectiveAt:now});
  if(!access?.employeeId)fail(403,"STORE_OPERATIONS_ACCESS_REQUIRED","Store Operations access required.");
  const handoffCode=code(); const expiresAt=now+STORE_OPERATIONS_HANDOFF.handoffTtlSeconds*1000;
  if(sourceExpiry<=expiresAt)fail(401,"HUB_SESSION_TOO_SHORT","NOV HUB session expires too soon.");
  await deps.store.insert({codeHash:await hash(handoffCode),employeeId:identity.employeeId,hubSessionId:identity.sessionId,
    hubSessionExpiresAt:sourceExpiry,target:STORE_OPERATIONS_HANDOFF.target,targetOrigin:STORE_OPERATIONS_HANDOFF.targetOrigin,
    audience:STORE_OPERATIONS_HANDOFF.handoffAudience,stateHash:await hash(input.state),nonceHash:await hash(`${handoffCode}.${input.state}`),
    requestId:deps.randomUuid(),issuedAt:now,expiresAt});
  return {handoffCode,state:input.state,targetOrigin:STORE_OPERATIONS_HANDOFF.targetOrigin,expiresAt:new Date(expiresAt).toISOString()};
}
export async function exchangeStoreOperationsHandoff(input,deps){
  if(!deps.verifyExchangeBoundary(input.exchangeProof))fail(401,"EXCHANGE_BOUNDARY_REQUIRED","Server exchange boundary required.");
  if(input.origin!==STORE_OPERATIONS_HANDOFF.targetOrigin)fail(403,"ORIGIN_MISMATCH","Store Operations origin mismatch.");
  if(!CODE_PATTERN.test(String(input.handoffCode||"")))fail(400,"INVALID_CODE","Invalid handoff code.");
  const now=deps.now(); const state=String(input.state||"");
  const row=await deps.store.consumeAtomic({codeHash:await hash(input.handoffCode),stateHash:await hash(state),nonceHash:await hash(`${input.handoffCode}.${state}`),
    target:STORE_OPERATIONS_HANDOFF.target,targetOrigin:STORE_OPERATIONS_HANDOFF.targetOrigin,audience:STORE_OPERATIONS_HANDOFF.handoffAudience,
    now,exchangeRequestId:deps.randomUuid()});
  if(!row)fail(401,"HANDOFF_REJECTED","Handoff expired, mismatched, or already consumed.");
  if(Number(row.hubSessionExpiresAt)<=now)fail(401,"HUB_SESSION_EXPIRED","Source NOV HUB session expired.");
  const access=await deps.resolveAccess({employeeId:row.employeeId,effectiveAt:now});
  if(!access?.employeeId)fail(403,"STORE_OPERATIONS_ACCESS_REQUIRED","Store Operations access no longer active.");
  const expiresAt=Math.min(now+STORE_OPERATIONS_HANDOFF.sessionTtlSeconds*1000,Number(row.hubSessionExpiresAt));
  return {sessionToken:await deps.signSession({v:1,sid:deps.randomUuid(),sub:row.employeeId,aud:STORE_OPERATIONS_HANDOFF.sessionAudience,
    auth_source:"nov_hub_handoff",iat:Math.floor(now/1000),exp:Math.floor(expiresAt/1000)}),
    audience:STORE_OPERATIONS_HANDOFF.sessionAudience,expiresAt:new Date(expiresAt).toISOString()};
}

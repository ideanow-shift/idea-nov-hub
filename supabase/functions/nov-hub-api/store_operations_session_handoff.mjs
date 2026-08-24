const CODE_PATTERN=/^[A-Za-z0-9_-]{43}$/u;
export const STORE_OPERATIONS_HANDOFF=Object.freeze({
  contract:"STORE_OPERATIONS_STAGING_SESSION_HANDOFF_V1",
  target:"STORE_OPERATIONS_STAGING",
  targetOrigin:"https://idea-nov-store-operations-staging-ui-787968950888.asia-northeast1.run.app",
  callbackPath:"/auth/callback",
  handoffAudience:"store_operations_staging_handoff_exchange_v1",
  sessionAudience:"store_operations_staging_session_v1",
  handoffTtlSeconds:60,sessionTtlSeconds:900
});
function fail(status,code,message){const e=new Error(message);e.status=status;e.code=code;throw e;}
function b64url(bytes){let value="";for(const byte of bytes)value+=String.fromCharCode(byte);return btoa(value).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");}
async function hash(value){return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(value)))));}
function code(){return b64url(crypto.getRandomValues(new Uint8Array(32)));}
async function pkceChallenge(verifier){return await hash(verifier);}
export async function issueStoreOperationsHandoff(input,deps){
  const now=deps.now(); const identity=input?.hubIdentity||{}; const sourceExpiry=Date.parse(String(identity.expiresAt||""));
  if(!identity.employeeId||!identity.sessionId||!Number.isFinite(sourceExpiry)||sourceExpiry<=now)fail(401,"HUB_AUTH_REQUIRED","Active NOV HUB session required.");
  if(input.target!==STORE_OPERATIONS_HANDOFF.target||input.targetOrigin!==STORE_OPERATIONS_HANDOFF.targetOrigin)fail(403,"TARGET_MISMATCH","Store Operations target mismatch.");
  if(input.callbackPath!==STORE_OPERATIONS_HANDOFF.callbackPath)fail(403,"CALLBACK_MISMATCH","Store Operations callback mismatch.");
  if(!/^[A-Za-z0-9_-]{22,128}$/u.test(String(input.state||"")))fail(400,"INVALID_STATE","Valid launch state required.");
  if(input.codeChallengeMethod!=="S256")fail(400,"INVALID_CHALLENGE_METHOD","PKCE S256 is required.");
  if(!/^[A-Za-z0-9_-]{43}$/u.test(String(input.codeChallenge||"")))fail(400,"INVALID_CODE_CHALLENGE","Valid PKCE challenge required.");
  const access=await deps.resolveAccess({employeeId:identity.employeeId,effectiveAt:now});
  if(!access?.employeeId)fail(403,"STORE_OPERATIONS_ACCESS_REQUIRED","Store Operations access required.");
  const handoffCode=code(); const expiresAt=now+STORE_OPERATIONS_HANDOFF.handoffTtlSeconds*1000;
  if(sourceExpiry<=expiresAt)fail(401,"HUB_SESSION_TOO_SHORT","NOV HUB session expires too soon.");
  await deps.store.insert({codeHash:await hash(handoffCode),employeeId:identity.employeeId,hubSessionId:identity.sessionId,
    hubSessionExpiresAt:sourceExpiry,target:STORE_OPERATIONS_HANDOFF.target,targetOrigin:STORE_OPERATIONS_HANDOFF.targetOrigin,
    contract:STORE_OPERATIONS_HANDOFF.contract,audience:STORE_OPERATIONS_HANDOFF.handoffAudience,callbackPath:STORE_OPERATIONS_HANDOFF.callbackPath,
    stateHash:await hash(input.state),nonceHash:await hash(`${handoffCode}.${input.state}`),codeChallenge:input.codeChallenge,
    requestId:deps.randomUuid(),issuedAt:now,expiresAt});
  return {handoffCode,state:input.state,targetOrigin:STORE_OPERATIONS_HANDOFF.targetOrigin,expiresAt:new Date(expiresAt).toISOString()};
}
export async function exchangeStoreOperationsHandoff(input,deps){
  await deps.verifyServerIdentity(input.oidcToken);
  if(!deps.verifyExchangeBoundary(input.exchangeProof))fail(401,"EXCHANGE_BOUNDARY_REQUIRED","Server exchange boundary required.");
  if(input.origin!==STORE_OPERATIONS_HANDOFF.targetOrigin)fail(403,"ORIGIN_MISMATCH","Store Operations origin mismatch.");
  if(!CODE_PATTERN.test(String(input.handoffCode||"")))fail(400,"INVALID_CODE","Invalid handoff code.");
  if(!/^[A-Za-z0-9._~-]{43,128}$/u.test(String(input.codeVerifier||"")))fail(401,"PKCE_VERIFIER_REQUIRED","PKCE verifier is required.");
  const now=deps.now(); const state=String(input.state||"");
  const row=await deps.store.consumeAtomic({codeHash:await hash(input.handoffCode),stateHash:await hash(state),nonceHash:await hash(`${input.handoffCode}.${state}`),
    codeChallenge:await pkceChallenge(input.codeVerifier),contract:STORE_OPERATIONS_HANDOFF.contract,target:STORE_OPERATIONS_HANDOFF.target,
    targetOrigin:STORE_OPERATIONS_HANDOFF.targetOrigin,callbackPath:STORE_OPERATIONS_HANDOFF.callbackPath,audience:STORE_OPERATIONS_HANDOFF.handoffAudience,
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

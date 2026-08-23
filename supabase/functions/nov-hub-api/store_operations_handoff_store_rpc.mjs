export function createStoreOperationsHandoffRpcStore(callRpc){return Object.freeze({
  async insert(row){const result=await callRpc("store_operations_handoff_issue_v1",{
    p_code_hash:row.codeHash,p_employee_id:row.employeeId,p_hub_session_id:row.hubSessionId,
    p_hub_session_expires_at:new Date(row.hubSessionExpiresAt).toISOString(),p_target:row.target,p_target_origin:row.targetOrigin,
    p_audience:row.audience,p_state_hash:row.stateHash,p_nonce_hash:row.nonceHash,p_request_id:row.requestId,
    p_issued_at:new Date(row.issuedAt).toISOString(),p_expires_at:new Date(row.expiresAt).toISOString()});
    if(!Array.isArray(result)||result.length!==1)throw new Error("STORE_OPERATIONS_HANDOFF_ISSUE_FAILED");},
  async consumeAtomic(match){const result=await callRpc("store_operations_handoff_consume_v1",{
    p_code_hash:match.codeHash,p_state_hash:match.stateHash,p_nonce_hash:match.nonceHash,p_target:match.target,
    p_target_origin:match.targetOrigin,p_audience:match.audience,p_consumed_at:new Date(match.now).toISOString(),
    p_exchange_request_id:match.exchangeRequestId}); const row=Array.isArray(result)?result[0]:null;
    return row?{employeeId:String(row.employee_id),hubSessionId:String(row.hub_session_id),hubSessionExpiresAt:Date.parse(row.hub_session_expires_at)}:null;}
});}

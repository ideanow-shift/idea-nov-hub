import { exchangeDbfStagingHandoff, issueDbfStagingHandoff } from "./dbf_session_handoff_candidate.mjs";

export const DBF_HANDOFF_ACTIONS = Object.freeze({
  issue: "dbfStagingHandoffIssueV1",
  exchange: "dbfStagingHandoffExchangeV1"
});

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = "INVALID_REQUEST";
  throw error;
}

export async function handleDbfHandoffAction(request, deps) {
  const payload = request?.payload || {};
  if (request.action === DBF_HANDOFF_ACTIONS.issue) {
    if (Object.keys(payload).some((key) => !new Set(["state", "authType"]).has(key))) {
      invalid("Issue payload contains unsupported fields.");
    }
    if (Object.hasOwn(payload, "authType") && payload.authType !== "hub_session") {
      invalid("Issue auth envelope is invalid.");
    }
    const hubIdentity = await deps.verifyHubRequest(request);
    return {
      status: 200,
      body: await issueDbfStagingHandoff({
        hubIdentity,
        state: payload.state,
        target: "DBF_STAGING",
        targetOrigin: "https://idea-nov-dbf-staging-ui-om6tepo36q-an.a.run.app"
      }, deps)
    };
  }
  if (request.action === DBF_HANDOFF_ACTIONS.exchange) {
    if (Object.keys(payload).some((key) => !new Set(["handoffCode", "state", "origin"]).has(key))) {
      invalid("Exchange payload contains unsupported fields.");
    }
    const bffIdentity = await deps.verifyStagingBffRequest({
      iapAssertion: request.iapAssertion,
      expectedOrigin: "https://idea-nov-dbf-staging-ui-om6tepo36q-an.a.run.app"
    });
    if (bffIdentity?.verified !== true) {
      const error = new Error("Verified DBF Staging BFF request is required.");
      error.status = 401;
      error.code = "IAP_REQUIRED";
      throw error;
    }
    return {
      status: 200,
      body: await exchangeDbfStagingHandoff({
        iapVerified: true,
        origin: payload.origin,
        handoffCode: payload.handoffCode,
        state: payload.state
      }, deps)
    };
  }
  invalid("Unsupported DBF handoff action.");
}

import { handleDbfHandoffAction } from "./dbf_handoff_actions_candidate.mjs";

// Candidate adapter for the existing nov-hub-api action router. The browser
// cannot declare IAP verification. Only the assertion forwarded by the Cloud
// Run BFF is extracted from the server request header and then independently
// validated by verifyStagingBffRequest.
export async function routeDbfHandoffCandidate({ request, body }, deps) {
  return handleDbfHandoffAction({
    action: String(body?.action || ""),
    payload: body?.payload || {},
    token: request.headers.get("authorization") || "",
    iapAssertion: request.headers.get("x-dbf-iap-assertion") || ""
  }, deps);
}

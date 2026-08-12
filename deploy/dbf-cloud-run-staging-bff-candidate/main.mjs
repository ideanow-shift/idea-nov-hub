import { createDbfStagingServer, port } from "./server.mjs";

function requiredExchangeUrl() {
  const raw = String(process.env.NOV_HUB_HANDOFF_EXCHANGE_URL || "").trim();
  let url;
  try { url = new URL(raw); } catch (_) { throw new Error("NOV_HUB_HANDOFF_EXCHANGE_URL is required."); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) {
    throw new Error("NOV_HUB_HANDOFF_EXCHANGE_URL must be a credential-free HTTPS URL.");
  }
  return url.toString();
}

async function exchangeWithHubBackend(request) {
  const response = await fetch(requiredExchangeUrl(), {
    method: "POST",
    redirect: "error",
    headers: {
      "content-type": "application/json",
      // Server-to-server only. The HUB backend independently verifies this
      // assertion for the exact DBF Staging Cloud Run audience.
      "x-dbf-iap-assertion": request.iapAssertion
    },
    body: JSON.stringify({ action: request.action, payload: request.payload })
  });
  const body = await response.json().catch(() => ({ code: "HUB_EXCHANGE_INVALID_RESPONSE" }));
  return { status: response.status, body };
}

const server = createDbfStagingServer({
  fetchJwks: async () => {
    const response = await fetch("https://www.gstatic.com/iap/verify/public_key-jwk", { redirect: "error" });
    if (!response.ok) throw new Error("IAP_JWKS_UNAVAILABLE");
    return response.json();
  },
  exchangeWithHubBackend
});

server.listen(port, "0.0.0.0");

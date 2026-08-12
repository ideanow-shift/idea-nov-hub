const MANAGEMENT_APP_PATH = "/management-app/index.html";

export function canonicalManagementTarget(hash = "") {
  const incoming = new URLSearchParams(String(hash).replace(/^#/, ""));
  const handoffCode = incoming.get("handoff_code");
  if (!handoffCode) return `${MANAGEMENT_APP_PATH}#businessdata`;

  const outgoing = new URLSearchParams({ handoff_code: handoffCode });
  const state = incoming.get("state");
  if (state) outgoing.set("state", state);
  return `${MANAGEMENT_APP_PATH}#${outgoing.toString()}`;
}

if (typeof window !== "undefined" && typeof window.location?.replace === "function") {
  window.location.replace(canonicalManagementTarget(window.location.hash));
}

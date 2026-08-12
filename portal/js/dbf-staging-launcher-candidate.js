const TARGET_ORIGIN = "https://idea-nov-dbf-staging-ui-om6tepo36q-an.a.run.app";

function randomState() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function buildDbfStagingLaunchUrl({ issue }) {
  const state = randomState();
  const result = await issue({ action: "dbfStagingHandoffIssueV1", payload: { state } });
  const handoffCode = String(result?.handoffCode || result?.body?.handoffCode || "");
  if (!/^[A-Za-z0-9_-]{43}$/u.test(handoffCode)) throw new Error("DBF Staging handoff could not be issued.");
  const url = new URL(TARGET_ORIGIN);
  url.hash = new URLSearchParams({ handoff_code: handoffCode, state }).toString();
  return url.toString();
}

export async function openDbfStagingFromAuthorizedAdmin(options) {
  const url = await buildDbfStagingLaunchUrl(options);
  window.location.assign(url);
}

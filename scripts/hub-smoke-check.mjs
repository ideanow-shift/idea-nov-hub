const CHECKS = [
  {
    name: "NOV HUB top",
    url: "https://ideanow-shift.github.io/idea-nov-hub/",
    includes: ["NOV HUB", "IDEANOV"],
  },
  {
    name: "Master admin",
    url: "https://ideanow-shift.github.io/idea-nov-hub/master-admin/",
    includes: ["master-admin.js", "マスタ管理"],
  },
  {
    name: "NOV Navi",
    url: "https://ideanow-shift.github.io/idea-nov-hub/concierge/",
    includes: ["NOV Navi"],
  },
  {
    name: "IDEA LINK bridge",
    url: "https://ideanow-shift.github.io/idea-nov-hub/idea-link/",
    includes: ["IDEA LINKへ移動中", "HUB_CONTEXT_QUERY_KEY", "encodeHubContextForUrl"],
  },
  {
    name: "Expense Hub",
    url: "https://ideanow-shift.github.io/idea-nov-expense-hub/",
    includes: ["Expense", "経費"],
    anyInclude: true,
  },
  {
    name: "Runtime config",
    url: "https://ideanow-shift.github.io/idea-nov-hub/js/firebase-config.js",
    includes: ['apiMode: "edge"', 'apiFallback: "edge-only"', 'gasApiUrl: ""'],
    excludes: ["script.google.com"],
  },
];

const HEALTH_URL = "https://nkmxevmioczcmnldreyo.supabase.co/functions/v1/nov-hub-api?action=health";
const REQUIRED_HEALTH_CHECKS = [
  "supabaseUrlConfigured",
  "supabaseServiceRoleKeyConfigured",
  "pinHashPepperConfigured",
  "firebaseApiKeyConfigured",
  "employeesReachable",
  "loginCredentialsReachable",
  "employeeRolesReachable",
  "storesReachable",
  "bootstrapRpcReachable",
  "notificationDestinationsReachable",
  "portalAppsReachable",
  "accessLogsReachable",
];

async function fetchText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const text = await response.text();
  return { response, text };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function checkPage(check) {
  const { response, text } = await fetchText(check.url);
  assert(response.ok, `${check.name}: HTTP ${response.status}`);
  const missing = (check.includes || []).filter((needle) => !text.includes(needle));
  if (check.anyInclude) {
    assert(missing.length < (check.includes || []).length, `${check.name}: none of expected strings found`);
  } else {
    assert(!missing.length, `${check.name}: missing ${missing.join(", ")}`);
  }
  const presentExcluded = (check.excludes || []).filter((needle) => text.includes(needle));
  assert(!presentExcluded.length, `${check.name}: unexpected ${presentExcluded.join(", ")}`);
  return { name: check.name, status: response.status, bytes: text.length };
}

async function checkHealth() {
  const { response, text } = await fetchText(HEALTH_URL);
  assert(response.ok, `Health: HTTP ${response.status}`);
  const data = JSON.parse(text);
  assert(data.ok === true, "Health: ok is not true");
  const missing = REQUIRED_HEALTH_CHECKS.filter((key) => data.checks?.[key] !== true);
  assert(!missing.length, `Health: checks not true: ${missing.join(", ")}`);
  return { name: "NOV HUB Edge health", status: response.status, checked: REQUIRED_HEALTH_CHECKS.length };
}

async function main() {
  const startedAt = new Date().toISOString();
  const results = [];
  for (const check of CHECKS) {
    results.push(await checkPage(check));
  }
  results.push(await checkHealth());
  console.log(JSON.stringify({
    ok: true,
    startedAt,
    finishedAt: new Date().toISOString(),
    results,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    message: error.message,
    stack: error.stack,
  }, null, 2));
  process.exit(1);
});

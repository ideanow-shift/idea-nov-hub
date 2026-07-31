import { readHubEmployeeContext } from "../js/hub-context.js";
import { restoreNovHubSession } from "../js/nov-hub-session-candidate.js";
import { resolveNovTalentAccess } from "../js/nov-talent-access.js";

function isLoopback(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function resolveNovTalentLaunchAuthorization({ session, context, hostname = "" } = {}) {
  if (!session || !context) {
    return Object.freeze({ allowed: false, category: "AUTH_REQUIRED", access: resolveNovTalentAccess({}) });
  }
  if (context.authType === "demo" && !isLoopback(hostname)) {
    return Object.freeze({ allowed: false, category: "AUTH_REQUIRED", access: resolveNovTalentAccess({}) });
  }
  const access = resolveNovTalentAccess(context);
  if (!access.allowed) return Object.freeze({ allowed: false, category: "FORBIDDEN", access });
  return Object.freeze({ allowed: true, category: "AUTHORIZED", access });
}

function createGuardScreen(documentObject, category) {
  const screen = documentObject.createElement("main");
  screen.id = "talent-auth-guard";
  screen.className = "talent-auth-guard";
  screen.dataset.category = category;
  const forbidden = category === "FORBIDDEN";
  screen.innerHTML = `
    <section>
      <p class="eyebrow">NOV Talent</p>
      <h1>${forbidden ? "403｜求人管理の権限がありません" : "NOV HUBへのログインが必要です"}</h1>
      <p>${forbidden ? "このアカウントには求人管理が表示されません。権限が必要な場合は総務人事部へ確認してください。" : "セッションがないか、期限が切れています。NOV HUBへ戻ってログインし直してください。"}</p>
      <a href="../">NOV HUBへ戻る</a>
    </section>`;
  return screen;
}

export function installNovTalentAuthGuard({
  documentObject = globalThis.document,
  windowObject = globalThis.window,
  session = restoreNovHubSession(),
  context = readHubEmployeeContext()
} = {}) {
  const result = resolveNovTalentLaunchAuthorization({
    session,
    context,
    hostname: windowObject?.location?.hostname || ""
  });
  if (!documentObject?.body) return result;
  documentObject.body.dataset.talentAuth = result.category;
  documentObject.body.dataset.talentAccess = result.access.profile;
  if (!result.allowed) {
    documentObject.querySelector(".dashboard-shell")?.setAttribute("hidden", "");
    documentObject.body.prepend(createGuardScreen(documentObject, result.category));
    return result;
  }
  const roleLabel = documentObject.getElementById("talent-role-label");
  if (roleLabel) roleLabel.textContent = result.access.label;
  return result;
}

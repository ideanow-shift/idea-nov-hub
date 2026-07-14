import { resolveAppIcon } from "./apps.js";

const STATUS_LABELS = {
  available: "利用可能",
  trial: "試験運用",
  in_progress: "作成中",
  preview: "サンプル",
  coming_soon: "準備中"
};

const SYSTEMS = [
  { category: "運営管理", title: "タスク管理", status: "available", aliases: ["TASK", "task-management"], shortcuts: ["自分", "本部", "共有", "管理"] },
  { category: "運営管理", title: "勤怠管理｜打刻画面", status: "trial", aliases: ["attendance_kiosk", "attendance"], shortcuts: ["出勤打刻", "退勤打刻", "勤務実績確認"], audience: "全社員" },
  { category: "運営管理", title: "勤怠管理｜管理画面", status: "trial", aliases: ["attendance_admin"], shortcuts: ["勤務実績管理", "打刻修正", "承認"], minLevel: 3, anyCapabilities: ["attendance.manage"], audience: "店長以上・許可された本部スタッフ" },
  { category: "運営管理", title: "シフト管理", status: "trial", aliases: ["shift"], shortcuts: ["希望", "作成・調整", "公平性", "出力"] },
  { category: "運営管理", title: "経費精算", status: "trial", aliases: ["expense_hub", "expense-hub"], shortcuts: ["経費入力", "自分の申請", "月次精算"] },
  { category: "運営管理", title: "決裁・承認", status: "in_progress", aliases: ["decision_hub", "decision-hub"], shortcuts: ["自分の申請", "承認待ち", "申請一覧"] },
  { category: "運営管理", title: "店舗運営", status: "preview", aliases: ["pos"], shortcuts: ["POS", "販促・SNS"] },
  { category: "成長", title: "IDEA LINK", subtitle: "サンクスコイン・称賛文化", status: "available", aliases: ["idea-link"], shortcuts: ["ホーム", "送る", "一覧", "マイページ"] },
  { category: "成長", title: "店舗改善・成長", status: "trial", aliases: ["management-platform", "management-check", "Check-in"], shortcuts: ["チェック", "改善", "記録", "業績"] },
  { category: "成長", title: "教育・育成", status: "available", aliases: ["EDU", "education-web"], shortcuts: ["学習", "進捗", "管理"] },
  { category: "キャリア", title: "キャリアシステム", status: "preview", aliases: [], shortcuts: ["自己振り返り", "4ヶ月キャリア確認", "管理者確認", "昇格・等級", "次期目標設定"] },
  { category: "経営管理", title: "経営管理システム", status: "in_progress", aliases: ["keiei", "management-system"], shortcuts: ["法人管理", "店舗営業管理", "データ状況"], minLevel: 3, audience: "店長以上／管轄範囲" },
  { category: "経営管理", title: "採用・人財", subtitle: "NOV Talent / リクルート管理", status: "trial", aliases: ["jinnjibu", "human-capital-investment"], shortcuts: ["採用", "学生", "面接・選考", "現職者管理", "入社手続き", "採用ROI"], minLevel: 4, anyCapabilities: ["human_capital.all"], audience: "総務人事・経理・部長／許可範囲" },
  { category: "システム管理", title: "システム管理", status: "available", aliases: ["core-master-admin", "master-admin"], shortcuts: ["社員情報", "店舗情報", "法人情報", "アプリ管理", "権限管理", "変更履歴", "Data Intake"], adminOnly: true }
];

const CATEGORY_ORDER = ["運営管理", "成長", "キャリア", "経営管理", "システム管理"];

export function isLoopbackHostName(hostname) {
  return hostname === "127.0.0.1" || hostname === "localhost";
}

export function shouldEnableLocalNovNaviDemo({ hostname, search = "" }) {
  const query = new URLSearchParams(search);
  return isLoopbackHostName(hostname)
    && query.get("nov_navi_preview") === "1"
    && query.get("demo") === "1";
}

export function shouldEnableNovNaviDashboard({ featureEnabled, hostname, search = "" }) {
  const query = new URLSearchParams(search);
  if (query.get("legacy") === "1") return false;
  return featureEnabled === true
    || (isLoopbackHostName(hostname) && query.get("nov_navi_preview") === "1");
}

function escapeHtml(value) {
  const span = document.createElement("span");
  span.textContent = String(value ?? "");
  return span.innerHTML;
}

function appKey(value) {
  return String(value || "").toLowerCase().replace(/[\s_・/-]/g, "");
}

function findApp(apps, aliases) {
  const keys = new Set(aliases.map(appKey));
  return apps.find((app) => keys.has(appKey(app.appId)) || keys.has(appKey(app.appName)));
}

function isAdmin(employee) {
  const roles = new Set((employee?.roleKeys || employee?.roles || []).map(appKey));
  return roles.has("superadmin") || roles.has("systemadmin");
}

function roleProfile(employee) {
  if (isAdmin(employee)) return { key: "system_admin", label: "システム管理者" };
  const level = Number(employee?.roleLevel || 1);
  const tags = new Set((employee?.tags || []).map(appKey));
  const store = appKey(employee?.store);
  const isHeadquarters = store === appKey("本部") || tags.has("hq") || tags.has("backoffice");
  if (level >= 4) return { key: "executive", label: "部長・経営" };
  if (isHeadquarters) return { key: "headquarters_staff", label: "本部スタッフ" };
  if (level >= 3) return { key: "store_manager", label: "店長" };
  return { key: "employee", label: "一般社員" };
}

function visibleSystem(system, employee) {
  if (system.adminOnly) return isAdmin(employee);
  const capabilities = new Set((employee?.capabilities || []).map(appKey));
  if ((system.anyCapabilities || []).some((capability) => capabilities.has(appKey(capability)))) return true;
  return Number(employee?.roleLevel || 1) >= Number(system.minLevel || 1);
}

function createSystemCard(system, apps, onOpenApp) {
  const app = findApp(apps, system.aliases);
  const isSampleApp = Boolean(app && String(app.url || "").startsWith("#demo-"));
  const fallbackIcon = resolveAppIcon({});
  const iconSource = app && !isSampleApp ? resolveAppIcon(app) : fallbackIcon;
  const actualStatus = isSampleApp
    ? "preview"
    : app
      ? system.status
      : (system.status === "available" ? "coming_soon" : system.status);
  const actionLabel = actualStatus === "preview" ? "サンプルを見る" : app ? "システムを開く" : "予定機能を見る";
  const card = document.createElement("article");
  card.className = `navi-system-card status-${actualStatus}`;
  card.innerHTML = `
    <div class="navi-card-heading">
      <div class="navi-card-title"><span class="navi-system-icon"><img src="${escapeHtml(iconSource)}" alt="" aria-hidden="true"></span><div><h4>${escapeHtml(system.title)}</h4>${system.subtitle ? `<p>${escapeHtml(system.subtitle)}</p>` : ""}</div></div>
      <div><span class="navi-status">${escapeHtml(STATUS_LABELS[actualStatus])}</span>${system.audience ? `<small class="navi-audience">${escapeHtml(system.audience)}</small>` : ""}</div>
    </div>
    <div class="navi-shortcuts">${system.shortcuts.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
    <button type="button" class="navi-open-button">${actionLabel}</button>`;
  const button = card.querySelector(".navi-open-button");
  button.setAttribute("aria-label", `${system.title}：${actionLabel}`);
  const icon = card.querySelector(".navi-system-icon img");
  icon.addEventListener("error", () => { icon.src = fallbackIcon; }, { once: true });
  button.addEventListener("click", () => {
    if (app) onOpenApp(app);
    else window.alert(`${system.title}は${STATUS_LABELS[actualStatus]}です。現在はデータを保存しません。`);
  });
  return card;
}

const LEGACY_HOME_HIDDEN_STATE = new WeakMap();

function toggleLegacyHome(enabled) {
  [".concierge-entry", "#notice-heading", "#featured-heading"].forEach((selector) => {
    const element = document.querySelector(selector);
    const section = element?.closest("section");
    if (!section) return;
    if (enabled) {
      if (!LEGACY_HOME_HIDDEN_STATE.has(section)) {
        LEGACY_HOME_HIDDEN_STATE.set(section, section.hidden);
      }
      section.hidden = true;
      return;
    }
    if (LEGACY_HOME_HIDDEN_STATE.has(section)) {
      section.hidden = LEGACY_HOME_HIDDEN_STATE.get(section);
      LEGACY_HOME_HIDDEN_STATE.delete(section);
    }
  });
}

export function renderNovNaviDashboard({ enabled, employee, apps, onOpenApp, onOpenSupport }) {
  const root = document.querySelector("#nov-navi-dashboard");
  if (!root) return;
  root.hidden = !enabled;
  toggleLegacyHome(Boolean(enabled));
  if (!enabled) return;

  const profile = roleProfile(employee);
  root.innerHTML = `
    <div class="navi-role-summary"><span>表示区分</span><strong>${escapeHtml(profile.label)}</strong><small>起動時に各システム側で権限を再確認します</small></div>
    <div class="navi-today" aria-labelledby="navi-today-title">
      <div class="navi-section-heading"><h2 id="navi-today-title">Today</h2><span>サンプル表示</span></div>
      <div class="navi-today-grid">
        <div class="navi-today-card"><span>今日の予定</span><strong>3件</strong><small>10:00 朝礼</small></div>
        <div class="navi-today-card"><span>未完了タスク</span><strong>4件</strong><small>サンプル</small></div>
        <div class="navi-today-card"><span>承認待ち</span><strong>2件</strong></div>
        <div class="navi-today-card"><span>サンクス受信</span><strong>2件</strong></div>
        <div class="navi-today-card"><span>問い合わせ回答</span><strong>1件</strong></div>
        <div class="navi-today-card"><span>成長ポイント</span><strong>48pt</strong></div>
      </div>
    </div>
    <div class="navi-support">
      <div><h2>NOV サポート</h2><p>就業規則や社内手続きは、サポート画面で確認できます</p></div>
      <button class="navi-support-launcher" type="button">NOVサポートを開く</button>
    </div>
    <div class="navi-system-sections"></div>
    <p class="navi-legacy-apps">その他の既存アプリは、このダッシュボード下部の「すべての業務（既存アプリ一覧）」から開けます。</p>
    <div class="navi-legend"><span>利用可能：本番システム</span><span>試験運用：利用範囲を限定</span><span>作成中：利用可能範囲のみ</span><span>サンプル：データは保存されません</span></div>`;

  root.querySelector(".navi-support-launcher").addEventListener("click", () => {
    onOpenSupport("");
  });

  const sections = root.querySelector(".navi-system-sections");
  CATEGORY_ORDER.forEach((category) => {
    const systems = SYSTEMS.filter((system) => system.category === category && visibleSystem(system, employee));
    if (!systems.length) return;
    const section = document.createElement("section");
    section.className = "navi-category";
    section.innerHTML = `<div class="navi-section-heading"><h2>${escapeHtml(category)}</h2>${category === "経営管理" ? "<span>店長以上</span>" : category === "システム管理" ? "<span>システム管理者のみ</span>" : ""}</div><div class="navi-system-grid"></div>`;
    const grid = section.querySelector(".navi-system-grid");
    grid.append(...systems.map((system) => createSystemCard(system, apps, onOpenApp)));
    sections.append(section);
  });
}

import { resolveAppIcon } from "./apps.js?v=nov-talent-hub-launch-20260801-1";
import { resolveNovTalentAccess } from "./nov-talent-access.js";

const STATUS_LABELS = {
  available: "利用可能",
  trial: "試験運用",
  in_progress: "作成中",
  preview: "サンプル",
  coming_soon: "準備中"
};

const SYSTEM_ICON_BY_ALIAS = Object.freeze({
  "task-management": "./assets/icons/task.svg",
  attendance_kiosk: "./assets/icons/attendance.svg",
  attendance_admin: "./assets/icons/attendance.svg",
  shift: "./assets/icons/shift.svg",
  expense_hub: "./assets/icons/expense-hub.svg",
  decision_hub: "./assets/icons/approval.svg",
  pos: "./assets/icons/store-operations.svg",
  "idea-link": "./assets/icons/philosophy.svg",
  "management-platform": "./assets/icons/management-check.svg",
  EDU: "./assets/icons/education.svg",
  "management-system": "./assets/icons/management.svg",
  "store-sales-management": "./assets/icons/sales.svg",
  "human-capital-investment": "./assets/icons/human-capital-investment.svg",
  "core-master-admin": "./assets/icons/database.svg"
});

const SYSTEMS = [
  { category: "運営管理", title: "タスク管理", status: "available", aliases: ["TASK", "task-management"], shortcuts: ["自分", "本部", "共有", "管理"] },
  { category: "運営管理", title: "勤怠管理｜打刻画面", status: "trial", aliases: ["attendance_kiosk", "attendance"], shortcuts: ["出勤打刻", "退勤打刻", "勤務実績確認"], audience: "全社員" },
  { category: "運営管理", title: "勤怠管理（管理者）", subtitle: "勤怠の確認・修正・承認", status: "trial", aliases: ["attendance_admin"], shortcuts: ["勤務実績管理", "打刻修正", "承認"], minLevel: 3, anyCapabilities: ["attendance.manage"], audience: "店長以上・承認担当" },
  { category: "運営管理", title: "シフト管理", status: "trial", aliases: ["shift"], shortcuts: ["希望", "作成・調整", "公平性", "出力"] },
  { category: "運営管理", title: "経費精算", status: "trial", aliases: ["expense_hub", "expense-hub"], shortcuts: ["経費入力", "自分の申請", "月次精算"] },
  { category: "運営管理", title: "決裁・承認", status: "in_progress", aliases: ["decision_hub", "decision-hub"], shortcuts: ["自分の申請", "承認待ち", "申請一覧"] },
  { category: "運営管理", title: "店舗運営", status: "preview", aliases: ["pos"], shortcuts: ["POS", "販促・SNS"] },
  { category: "成長", title: "サンクスコイン", subtitle: "感謝・称賛をコインで届ける", status: "available", aliases: ["idea-link"], shortcuts: ["ホーム", "送る", "一覧", "マイページ"] },
  { category: "成長", title: "店舗改善・成長", status: "trial", aliases: ["management-platform", "management-check", "Check-in"], shortcuts: ["チェック", "改善", "記録", "業績"] },
  { category: "成長", title: "教育・育成", status: "available", aliases: ["EDU", "education-web"], shortcuts: ["学習", "進捗", "管理"] },
  { category: "キャリア", title: "キャリアシステム", status: "preview", icon: "./assets/icons/career.svg", aliases: [], shortcuts: ["自己振り返り", "4ヶ月キャリア確認", "管理者確認", "昇格・等級", "次期目標設定"] },
  { category: "経営管理", title: "経営管理システム", status: "in_progress", aliases: ["keiei", "management-system"], shortcuts: ["法人管理", "店舗営業管理", "データ状況"], minLevel: 3, audience: "店長以上／管轄範囲" },
  { category: "経営管理", title: "店舗営業管理", subtitle: "売上・利益・KPI・店舗運営を確認", status: "preview", aliases: ["store-sales-management", "store-sales-preview"], shortcuts: ["全店の状況", "要対応店舗", "店舗詳細"], minLevel: 3, allowedTags: ["executive", "representative", "department_manager", "sales_manager", "area_manager", "store_manager"], audience: "営業管理の許可範囲" },
  { category: "経営管理", title: "求人管理", subtitle: "NOV Talent", description: "候補者・選考・イベント・次回対応を管理", status: "trial", aliases: ["nov-talent", "jinnjibu", "human-capital-investment"], shortcuts: ["候補者", "選考", "イベント", "次回対応"], talentOnly: true, audience: "代表取締役・総務人事部・採用担当" },
  { category: "システム管理", title: "システム管理", status: "available", aliases: ["core-master-admin", "master-admin"], shortcuts: ["社員情報", "店舗情報", "法人情報", "アプリ管理", "権限管理", "変更履歴", "データ入力"], adminOnly: true }
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

export function getNaviGreeting(hour = new Date().getHours()) {
  const normalizedHour = Number(hour);
  if (normalizedHour < 12) return "おはようございます。今日の仕事を確認しましょう。";
  if (normalizedHour < 18) return "おつかれさまです。今日の進み具合を確認しましょう。";
  return "おつかれさまです。明日の準備を確認しましょう。";
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
  if (isAdmin(employee)) return true;
  if (system.talentOnly) return resolveNovTalentAccess(employee).allowed;
  if (system.adminOnly) return isAdmin(employee);
  const capabilities = new Set((employee?.capabilities || []).map(appKey));
  if ((system.anyCapabilities || []).some((capability) => capabilities.has(appKey(capability)))) return true;
  if (system.allowedTags?.length) {
    const tags = new Set([
      ...(employee?.tags || []),
      ...(employee?.roleKeys || []),
      ...((employee?.roles || []).map((role) => role?.roleKey || role?.role_key))
    ].map(appKey));
    if (!system.allowedTags.some((tag) => tags.has(appKey(tag)))) return false;
  }
  return Number(employee?.roleLevel || 1) >= Number(system.minLevel || 1);
}

export function getVisibleNaviCategories(employee) {
  return CATEGORY_ORDER.filter((category) => (
    SYSTEMS.some((system) => system.category === category && visibleSystem(system, employee))
  ));
}

export function getNaviCategoryId(category) {
  const index = CATEGORY_ORDER.indexOf(category);
  return index === -1 ? "" : `navi-category-${index + 1}`;
}

export function getNaviCategoryAudienceHint(category) {
  const hints = {
    "運営管理": "毎日の業務",
    "成長": "学び・改善",
    "キャリア": "自分のキャリア",
    "経営管理": "店長以上・許可範囲",
    "システム管理": "システム管理者のみ"
  };
  return hints[category] || "";
}

export function getNaviLaunchState(system, app) {
  const isSampleApp = Boolean(app && String(app.url || "").startsWith("#demo-"));
  const status = isSampleApp
    ? "preview"
    : app
      ? system.status
      : "coming_soon";
  if (!app) {
    return { status, actionLabel: "接続準備中", enabled: false };
  }
  return {
    status,
    actionLabel: isSampleApp ? "サンプルを見る" : "システムを開く",
    enabled: true
  };
}

function createSystemCard(system, apps, onOpenApp) {
  const app = findApp(apps, system.aliases);
  const fallbackIcon = resolveAppIcon({});
  const establishedIcon = system.icon || system.aliases.map((alias) => SYSTEM_ICON_BY_ALIAS[alias]).find(Boolean);
  const iconSource = establishedIcon || (app ? resolveAppIcon(app) : fallbackIcon);
  const launchState = getNaviLaunchState(system, app);
  const actualStatus = launchState.status;
  const actionLabel = launchState.actionLabel;
  const card = document.createElement("article");
  card.className = `navi-system-card status-${actualStatus}`;
  card.innerHTML = `
    <div class="navi-card-heading">
      <div class="navi-card-title"><span class="navi-system-icon"><img src="${escapeHtml(iconSource)}" alt="" aria-hidden="true"></span><div><h4>${escapeHtml(system.title)}</h4>${system.subtitle ? `<p>${escapeHtml(system.subtitle)}</p>` : ""}${system.description ? `<p class="navi-system-description">${escapeHtml(system.description)}</p>` : ""}</div></div>
      <div><span class="navi-status">${escapeHtml(STATUS_LABELS[actualStatus])}</span>${system.audience ? `<small class="navi-audience">${escapeHtml(system.audience)}</small>` : ""}</div>
    </div>
    <div class="navi-shortcuts">${system.shortcuts.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
    <button type="button" class="navi-open-button">${actionLabel}</button>`;
  const button = card.querySelector(".navi-open-button");
  button.setAttribute("aria-label", `${system.title}：${actionLabel}`);
  button.disabled = !launchState.enabled;
  button.setAttribute("aria-disabled", String(!launchState.enabled));
  const icon = card.querySelector(".navi-system-icon img");
  icon.addEventListener("error", () => { icon.src = fallbackIcon; }, { once: true });
  button.addEventListener("click", async () => {
    if (!launchState.enabled || button.disabled) return;
    const defaultLabel = actionLabel;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = "起動を確認中...";
    try {
      await onOpenApp(app);
    } finally {
      button.disabled = false;
      button.removeAttribute("aria-busy");
      button.textContent = defaultLabel;
    }
  });
  return card;
}

const LEGACY_HOME_HIDDEN_STATE = new WeakMap();
const LEGACY_APPS_REVEALED = new WeakSet();

function toggleLegacyHome(enabled) {
  [".concierge-entry", "#notice-heading", "#featured-heading", ".legacy-apps-section"].forEach((selector) => {
    const element = document.querySelector(selector);
    const section = element?.closest("section");
    if (!section) return;
    if (enabled) {
      if (!LEGACY_HOME_HIDDEN_STATE.has(section)) {
        LEGACY_HOME_HIDDEN_STATE.set(section, section.hidden);
      }
      section.hidden = section.matches(".legacy-apps-section") && LEGACY_APPS_REVEALED.has(section) ? false : true;
      return;
    }
    if (LEGACY_HOME_HIDDEN_STATE.has(section)) {
      section.hidden = LEGACY_HOME_HIDDEN_STATE.get(section);
      LEGACY_HOME_HIDDEN_STATE.delete(section);
    }
  });
}

function revealLegacyApps() {
  const disclosure = document.querySelector(".legacy-apps-disclosure");
  const section = disclosure?.closest("section");
  if (!disclosure || !section) return;
  LEGACY_APPS_REVEALED.add(section);
  section.hidden = false;
  disclosure.open = true;
  section.scrollIntoView({ behavior: "smooth", block: "start" });
  disclosure.querySelector("#app-search")?.focus({ preventScroll: true });
}

function createNaviNoticeItem(notice, onOpenNotice) {
  const item = document.createElement(notice.actionable ? "button" : "article");
  item.className = `navi-notice${notice.unread ? " is-unread" : ""}`;
  if (notice.actionable) item.type = "button";
  item.innerHTML = `
    <span class="navi-notice-state">${notice.type === "important" ? "重要" : "お知らせ"}</span>
    <span class="navi-notice-copy"><strong>${escapeHtml(notice.title || "お知らせ")}</strong><small>${escapeHtml(notice.body || "詳細は各システムで確認できます。")}</small></span>
    ${notice.actionable ? '<span class="navi-notice-action">確認</span>' : ""}`;
  if (notice.actionable) {
    item.addEventListener("click", () => onOpenNotice(notice));
  }
  return item;
}

export function getVisibleNaviNotices(notices) {
  if (!Array.isArray(notices)) return [];
  return notices
    .filter((notice) => notice && typeof notice === "object")
    .map((notice, index) => ({ notice, index }))
    .sort((left, right) => {
      const unreadOrder = Number(Boolean(right.notice.unread)) - Number(Boolean(left.notice.unread));
      if (unreadOrder !== 0) return unreadOrder;
      const importantOrder = Number(right.notice.type === "important") - Number(left.notice.type === "important");
      if (importantOrder !== 0) return importantOrder;
      return left.index - right.index;
    })
    .slice(0, 3)
    .map(({ notice }) => notice);
}

function renderNaviNotices(notices, onOpenNotice) {
  const list = document.querySelector("#navi-notice-list");
  if (!list) return;
  const visibleNotices = getVisibleNaviNotices(notices);
  const section = list.closest(".navi-notices");
  if (!visibleNotices.length) {
    if (section) section.dataset.naviEmpty = "true";
    list.innerHTML = '<p class="navi-notice-empty">現在、新しいお知らせはありません。</p>';
    return;
  }
  if (section) delete section.dataset.naviEmpty;
  list.replaceChildren(...visibleNotices.map((notice) => createNaviNoticeItem(notice, onOpenNotice)));
}

const TODAY_KEYS = NOV_NAVI_TODAY_FIELDS;

export function getNaviTodaySnapshot(today) {
  return getNovNaviTodaySnapshot(today);
}

function renderNaviToday(root, today) {
  const counts = getNaviTodaySnapshot(today);
  const readyCount = counts.filter((count) => count !== null).length;
  const grid = root.querySelector(".navi-today-grid");
  const empty = root.querySelector(".navi-today-empty");
  const status = root.querySelector(".navi-today-status");

  if (grid) grid.hidden = readyCount === 0;
  if (empty) empty.hidden = readyCount !== 0;
  if (status) status.textContent = readyCount ? "連携済みの項目を表示中" : "連携を準備中";

  TODAY_KEYS.forEach((key, index) => {
    const card = root.querySelector(`[data-navi-today-key="${key}"]`);
    if (!card) return;
    const count = counts[index];
    card.hidden = count === null;
    if (count === null) return;
    const value = card.querySelector("strong");
    const detail = card.querySelector("small");
    if (!value || !detail) return;
    value.textContent = String(count);
    value.classList.remove("navi-pending-value");
    card.dataset.naviTodayState = "ready";
    card.setAttribute("aria-busy", "false");
    detail.textContent = "最新の連携値";
  });
}

export function renderNovNaviDashboard({ enabled, employee, apps, notices = [], today = null, onOpenApp, onOpenSupport, onOpenNotice = () => {} }) {
  const root = document.querySelector("#nov-navi-dashboard");
  if (!root) return;
  root.hidden = !enabled;
  toggleLegacyHome(Boolean(enabled));
  if (!enabled) return;

  const profile = roleProfile(employee);
  const visibleCategories = getVisibleNaviCategories(employee);
  root.innerHTML = `
    <div class="navi-role-summary"><span>表示区分</span><strong>${escapeHtml(profile.label)}</strong><div class="navi-role-categories" aria-label="表示中の業務領域">${visibleCategories.map((category) => `<button type="button" data-navi-category-target="${getNaviCategoryId(category)}">${escapeHtml(category)}</button>`).join("")}</div><small>起動時に各システム側で権限を再確認します</small></div>
    <section class="navi-today" aria-labelledby="navi-today-title">
      <div class="navi-section-heading"><h2 id="navi-today-title">今日の仕事</h2><span class="navi-today-status">連携を準備中</span></div>
      <p class="navi-today-greeting">${escapeHtml(getNaviGreeting())}</p>
      <p class="navi-today-empty">今日の予定・タスク・承認などを、この場所にまとめて表示します。</p>
      <div class="navi-today-grid" hidden>
        <div class="navi-today-card" data-navi-today-key="schedule"><span>今日の予定</span><strong class="navi-pending-value">準備中</strong><small>連携後に表示します</small></div>
        <div class="navi-today-card" data-navi-today-key="tasks"><span>未完了タスク</span><strong class="navi-pending-value">準備中</strong><small>連携後に表示します</small></div>
        <div class="navi-today-card" data-navi-today-key="approvals"><span>承認待ち</span><strong class="navi-pending-value">準備中</strong><small>連携後に表示します</small></div>
        <div class="navi-today-card" data-navi-today-key="thanks"><span>サンクス受信</span><strong class="navi-pending-value">準備中</strong><small>連携後に表示します</small></div>
        <div class="navi-today-card" data-navi-today-key="inquiries"><span>問い合わせ回答</span><strong class="navi-pending-value">準備中</strong><small>連携後に表示します</small></div>
        <div class="navi-today-card" data-navi-today-key="growthPoints"><span>成長ポイント</span><strong class="navi-pending-value">準備中</strong><small>連携後に表示します</small></div>
      </div>
    </section>
    <section class="navi-support" aria-labelledby="navi-support-title">
      <div><h2 id="navi-support-title">NOV サポート</h2><p>就業規則や社内手続きは、サポート画面で確認できます</p></div>
      <button class="navi-support-launcher" type="button">NOVサポートを開く</button>
    </section>
    <section class="navi-notices" aria-labelledby="navi-notices-title">
      <div class="navi-section-heading"><h2 id="navi-notices-title">お知らせ</h2><span>最新3件</span></div>
      <div class="navi-notice-list" id="navi-notice-list"></div>
    </section>
    <div class="navi-system-sections"></div>
    <div class="navi-legacy-apps"><button class="navi-legacy-launcher" type="button">すべての業務を開く</button></div>
    <div class="navi-legend"><span>利用可能：本番システム</span><span>試験運用：利用範囲を限定</span><span>作成中：利用可能範囲のみ</span><span>サンプル：データは保存されません</span></div>`;

  root.querySelector(".navi-support-launcher").addEventListener("click", () => {
    onOpenSupport("");
  });
  root.querySelector(".navi-legacy-launcher").addEventListener("click", revealLegacyApps);
  root.querySelector(".navi-today-grid")?.setAttribute("aria-live", "polite");
  root.querySelectorAll("[data-navi-today-key]").forEach((card) => {
    card.dataset.naviTodayState = "pending";
    card.setAttribute("aria-busy", "true");
  });
  root.querySelectorAll("[data-navi-category-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = root.querySelector(`#${button.dataset.naviCategoryTarget}`);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      target.querySelector(".navi-open-button:not(:disabled)")?.focus({ preventScroll: true });
    });
  });
  renderNaviToday(root, today);
  renderNaviNotices(notices, onOpenNotice);

  const sections = root.querySelector(".navi-system-sections");
  CATEGORY_ORDER.forEach((category, categoryIndex) => {
    const systems = SYSTEMS.filter((system) => system.category === category && visibleSystem(system, employee));
    if (!systems.length) return;
    const categoryId = getNaviCategoryId(category);
    const headingId = `navi-category-title-${categoryIndex + 1}`;
    const audienceHint = getNaviCategoryAudienceHint(category);
    const section = document.createElement("section");
    section.id = categoryId;
    section.className = "navi-category";
    section.setAttribute("aria-labelledby", headingId);
    section.dataset.naviCardCount = String(systems.length);
    section.innerHTML = `<div class="navi-section-heading"><h2 id="${headingId}">${escapeHtml(category)}</h2>${audienceHint ? `<span>${escapeHtml(audienceHint)}</span>` : ""}</div><div class="navi-system-grid"></div>`;
    const grid = section.querySelector(".navi-system-grid");
    grid.append(...systems.map((system) => createSystemCard(system, apps, onOpenApp)));
    sections.append(section);
  });
}
import { getNovNaviTodaySnapshot, NOV_NAVI_TODAY_FIELDS } from "./nov-navi-today-contract.js";

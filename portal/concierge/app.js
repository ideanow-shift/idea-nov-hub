const STORE_ACCOUNTS = [
  { id: "kokubunji", pass: "nov-kokubunji", name: "国分寺店", admin: false },
  { id: "tachikawa", pass: "nov-tachikawa", name: "立川店", admin: false },
  { id: "kumegawa", pass: "nov-kumegawa", name: "久米川店", admin: false },
  { id: "honbu", pass: "nov-admin", name: "本部", admin: true }
];

const STORE_MASTER_CONFIG = {
  loginEndpoint: "https://nkmxevmioczcmnldreyo.supabase.co/functions/v1/concierge-api",
  apiEndpoint: "https://nkmxevmioczcmnldreyo.supabase.co/functions/v1/concierge-api"
};

const SUPABASE_BACKEND_ACTIONS = new Set([
  "listAnswerRules",
  "appendLog",
  "updateRating",
  "listLogs",
  "listLinks",
  "updateLink",
  "appendAnswerRule",
  "updateAnswerRule",
  "listDepartmentRoutes",
  "createDepartmentInquiry",
  "listDepartmentInquiries",
  "listKnowledgeUpdates",
  "appendKnowledgeUpdate"
]);

const LINK_DEPARTMENT_ROUTES = {
  "hr-contact": "hr",
  "retirement-contact": "hr",
  "accounting-contact": "accounting",
  "education-contact": "education",
  "sales-contact": "sales",
  "fc-contact": "fc"
};

const STORAGE_KEYS = {
  session: "novConcierge.session.v1",
  logs: "novConcierge.logs.v1",
  knowledgeUpdates: "novConcierge.knowledgeUpdates.v1"
};

const HUB_CONTEXT_STORAGE_KEYS = [
  "novHub.context.v1",
  "novHubContext",
  "ideaNovHub.context.v1"
];

const HUB_ADMIN_ROLE_KEYS = new Set([
  "admin",
  "super_admin",
  "backoffice",
  "executive",
  "department_manager",
  "nov_navi.admin"
]);

const KNOWLEDGE_AREAS = [
  {
    id: "sandbox",
    name: "検証用",
    owner: "本部",
    notebook: "Notebook⑥",
    description: "新しい資料、回答品質、リンク導線を本番反映前に確認する検証用Notebook",
    sourceHref: "https://drive.google.com/drive/folders/12LiVPQt_esYMtZ0t4qftxXXXyxeBJJeK?usp=drive_link",
    notebookHref: "https://notebooklm.google.com/notebook/518da655-be3e-4c76-a323-8beb69c6f92d"
  },
  {
    id: "staff-support",
    name: "スタッフサポート",
    owner: "総務人事",
    notebook: "Notebook①",
    description: "就業規則、福利厚生、慶弔、給与、勤怠、社会保険、各種申請、FAQ",
    sourceHref: "https://drive.google.com/drive/folders/188b_tkR04bOgXbbrfYJKeGXWLF87fWkl?usp=drive_link",
    notebookHref: "https://notebooklm.google.com/notebook/0b22a0dd-d764-4380-8444-218683b4ee28"
  },
  {
    id: "education",
    name: "教育",
    owner: "教育部",
    notebook: "Notebook②",
    description: "技術マニュアル、接客、カウンセリング、教育資料、動画文字起こし",
    sourceHref: "https://drive.google.com/drive/folders/1Zflkf2P_cmLwpmGLw6xujjWsy5zNJ4Wp?usp=drive_link",
    notebookHref: "https://notebooklm.google.com/notebook/e5e2efce-740b-493f-b708-f3108e7f0084"
  },
  {
    id: "manager",
    name: "管理者",
    owner: "営業部",
    notebook: "Notebook③",
    description: "評価制度、面談、育成、環境整備、店長資料",
    sourceHref: "https://drive.google.com/drive/folders/1mRK3QKfJ9_2uwhf3Pz1yRxf1PhHbtOkB?usp=drive_link",
    notebookHref: "https://notebooklm.google.com/notebook/a6b01da9-00ea-4479-bb79-0b0fdd4300e6"
  },
  {
    id: "fc",
    name: "FC",
    owner: "FC担当",
    notebook: "Notebook④",
    description: "FC契約、出店、財務、運営",
    sourceHref: "https://drive.google.com/drive/folders/1gwAgEh2AGxzXdy1Z_odz_1B0m0Yxvlb1?usp=drive_link",
    notebookHref: "https://notebooklm.google.com/notebook/68e228cc-7580-4b34-92e9-0528cd81b187"
  },
  {
    id: "executive",
    name: "経営",
    owner: "幹部",
    notebook: "Notebook⑤",
    description: "経営会議、議事録、中期経営計画、財務、幹部資料",
    sourceHref: "https://drive.google.com/drive/folders/1xS4JzEndusMaClJtJ69g37TVLxFDgm_w?usp=drive_link",
    notebookHref: "https://notebooklm.google.com/notebook/07976b34-98f5-4c8b-9da0-7e5d701a9b1a"
  }
];

class StoreAuthProvider {
  async login(storeId, storePass) {
    if (STORE_MASTER_CONFIG.loginEndpoint) {
      const account = await authenticateWithStoreMaster(storeId, storePass);
      return this.persistSession(account);
    }

    const account = STORE_ACCOUNTS.find((item) => {
      return item.id === storeId.trim().toLowerCase() && item.pass === storePass;
    });

    if (!account) {
      throw new Error("店舗IDまたは店舗PASSが違います。");
    }

    return this.persistSession({ ...account, source: "local-fallback" });
  }

  persistSession(account) {
    const session = {
      id: account.id,
      storeId: account.storeId || account.id,
      name: account.name,
      admin: account.admin,
      token: account.token,
      source: account.source || "store-master",
      loginAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
    return session;
  }

  currentSession() {
    return readJson(STORAGE_KEYS.session, null);
  }

  logout() {
    localStorage.removeItem(STORAGE_KEYS.session);
  }
}

class HubContextAuthProvider {
  currentSession() {
    const context = readHubContext();
    if (!context) return null;
    return normalizeHubSession(context);
  }
}

class AuthProvider {
  constructor() {
    this.hub = new HubContextAuthProvider();
    this.store = new StoreAuthProvider();
  }

  async login(storeId, storePass) {
    return this.store.login(storeId, storePass);
  }

  currentSession() {
    return this.hub.currentSession() || this.store.currentSession();
  }

  logout() {
    this.store.logout();
  }
}

class KnowledgeAdapter {
  async ask({ question, store }) {
    const ruleResponse = await answerRuleRepository.find(question, store);
    return ruleResponse || this.mockNotebookLmResponse(question, store);
  }

  mockNotebookLmResponse(question, store) {
    const normalized = question.toLowerCase();
    const route = findRoute(normalized);
    return {
      notebook: route.notebook,
      answer: route.answer(store.name),
      links: route.links,
      confidence: route.confidence,
      riskLevel: route.riskLevel || "normal",
      requiresHumanCheck: Boolean(route.requiresHumanCheck)
    };
  }
}

class AnswerRuleRepository {
  constructor() {
    this.activeCache = null;
    this.adminCache = null;
  }

  async all(options = {}) {
    const includeInactive = Boolean(options.includeInactive);
    const cacheKey = includeInactive ? "adminCache" : "activeCache";
    if (this[cacheKey]) return this[cacheKey];
    if (!hasRemoteBackend()) {
      this[cacheKey] = [];
      return this[cacheKey];
    }

    try {
      const result = await requestBackend("listAnswerRules", includeInactive ? { includeInactive: "true" } : {});
      this[cacheKey] = result.ok ? result.rules : [];
      return this[cacheKey];
    } catch {
      this[cacheKey] = [];
      return this[cacheKey];
    }
  }

  clear() {
    this.activeCache = null;
    this.adminCache = null;
  }

  async find(question, store) {
    const normalized = question.toLowerCase();
    const rules = await this.all();
    const rule = rules.find((item) => {
      return isRuleActive(item.active) && item.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
    });

    if (!rule) return null;

    return {
      notebook: rule.notebook,
      answer: rule.answer.replaceAll("{{店舗名}}", store.name),
      links: rule.linkIds.map((id) => ({ id, label: id })),
      confidence: "rule-master",
      riskLevel: rule.riskLevel || "normal",
      requiresHumanCheck: Boolean(rule.requiresHumanCheck)
    };
  }
}

class ConversationLogRepository {
  all() {
    return readJson(STORAGE_KEYS.logs, []);
  }

  async allForAdmin() {
    if (!hasRemoteBackend()) {
      return this.all();
    }

    try {
      const result = await requestBackend("listLogs", {});
      return result.ok ? result.logs : this.all();
    } catch {
      return this.all();
    }
  }

  async append(entry) {
    const logs = this.all();
    logs.unshift(entry);
    localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(logs.slice(0, 300)));
    if (hasRemoteBackend()) {
      await requestBackend("appendLog", {
        logId: entry.id,
        createdAt: entry.createdAt,
        storeId: entry.storeUuid || entry.storeId,
        phase1LoginId: entry.phase1LoginId || entry.storeId,
        storeName: entry.storeName,
        question: entry.question,
        answer: entry.answer,
        notebook: entry.notebook,
        rating: entry.rating || "",
        links: JSON.stringify(entry.links || []),
        riskLevel: entry.riskLevel || "normal",
        needsHumanCheck: entry.needsHumanCheck ? "true" : "false",
        source: entry.source || "rule"
      });
    }
  }

  async updateRating(id, rating) {
    const currentEntry = this.all().find((entry) => entry.id === id);
    const logs = this.all().map((entry) => {
      return entry.id === id ? { ...entry, rating } : entry;
    });
    localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(logs));
    if (hasRemoteBackend()) {
      await requestBackend("updateRating", {
        logId: id,
        rating,
        storeId: currentEntry?.storeUuid || currentEntry?.storeId || "",
        phase1LoginId: currentEntry?.phase1LoginId || currentEntry?.storeId || ""
      });
    }
  }

  clearStore(storeId) {
    const logs = this.all().filter((entry) => entry.storeId !== storeId);
    localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(logs));
  }
}

class KnowledgeUpdateRepository {
  all() {
    return readJson(STORAGE_KEYS.knowledgeUpdates, []);
  }

  async allForAdmin() {
    if (!hasRemoteBackend()) {
      return this.all();
    }

    try {
      const result = await requestBackend("listKnowledgeUpdates", {});
      return result.ok ? result.updates : this.all();
    } catch {
      return this.all();
    }
  }

  async append(entry) {
    const updates = this.all();
    updates.unshift(entry);
    localStorage.setItem(STORAGE_KEYS.knowledgeUpdates, JSON.stringify(updates.slice(0, 100)));
    if (hasRemoteBackend()) {
      await requestBackend("appendKnowledgeUpdate", {
        updateId: entry.id,
        createdAt: entry.createdAt,
        areaId: entry.areaId,
        areaName: entry.areaName,
        owner: entry.owner,
        memo: entry.memo,
        updatedBy: entry.updatedBy,
        phase1LoginId: entry.phase1LoginId || session?.id || "",
        source: "NOV Navigator"
      });
    }
  }
}

class LinkMasterRepository {
  constructor() {
    this.cache = null;
  }

  async all() {
    if (this.cache) return this.cache;
    if (!hasRemoteBackend()) {
      this.cache = {};
      return this.cache;
    }

    try {
      const result = await requestBackend("listLinks", session?.admin && session?.token ? { includeInactive: "true" } : {});
      this.cache = result.ok ? Object.fromEntries(result.links.map((link) => [link.id, link])) : {};
      return this.cache;
    } catch {
      this.cache = {};
      return this.cache;
    }
  }

  clear() {
    this.cache = null;
  }

  async update(link) {
    const result = await requestBackend("updateLink", {
      linkId: link.id,
      label: link.label,
      href: link.href,
      category: link.category,
      owner: link.owner,
      description: link.description,
      active: link.active,
      sortOrder: String(link.sortOrder || 100)
    });
    if (!result.ok) throw new Error(result.error || "リンクを更新できませんでした。");
    this.clear();
    return result;
  }

  async resolve(links) {
    const linkMaster = await this.all();
    return links.map((link) => {
      const master = linkMaster[link.id];
      if (master && !isLinkActive(master.active)) return null;
      return {
        id: link.id,
        label: master?.label || link.label,
        href: master?.href || link.href || `#${link.id}`
      };
    }).filter(Boolean);
  }
}

class DepartmentInquiryRepository {
  constructor() {
    this.routeCache = null;
  }

  async routes() {
    if (this.routeCache) return this.routeCache;
    if (!hasRemoteBackend()) {
      this.routeCache = {};
      return this.routeCache;
    }

    try {
      const result = await requestBackend("listDepartmentRoutes", {});
      this.routeCache = result.ok ? Object.fromEntries(result.routes.map((route) => [route.id, route])) : {};
      return this.routeCache;
    } catch {
      this.routeCache = {};
      return this.routeCache;
    }
  }

  async create(inquiry) {
    const result = await requestBackend("createDepartmentInquiry", {
      routeId: inquiry.routeId,
      questionLogId: inquiry.questionLogId || "",
      subject: inquiry.subject,
      body: inquiry.body
    });
    if (!result.ok) throw new Error(result.error || "問い合わせを送信できませんでした。");
    return result;
  }

  async allForAdmin() {
    if (!hasRemoteBackend()) return [];
    const result = await requestBackend("listDepartmentInquiries", {});
    if (!result.ok) throw new Error(result.error || "問い合わせログを取得できませんでした。");
    return result.inquiries || [];
  }
}

const authProvider = new AuthProvider();
const answerRuleRepository = new AnswerRuleRepository();
const knowledgeAdapter = new KnowledgeAdapter();
const logRepository = new ConversationLogRepository();
const knowledgeUpdateRepository = new KnowledgeUpdateRepository();
const linkMasterRepository = new LinkMasterRepository();
const departmentInquiryRepository = new DepartmentInquiryRepository();

const elements = {
  loginView: document.querySelector("#loginView"),
  hubView: document.querySelector("#hubView"),
  adminView: document.querySelector("#adminView"),
  loginForm: document.querySelector("#loginForm"),
  loginError: document.querySelector("#loginError"),
  storeBadge: document.querySelector("#storeBadge"),
  logoutButton: document.querySelector("#logoutButton"),
  adminToggle: document.querySelector("#adminToggle"),
  backToHubButton: document.querySelector("#backToHubButton"),
  adminTabs: document.querySelectorAll("[data-admin-tab]"),
  adminPanels: document.querySelectorAll("[data-admin-panel]"),
  chatMessages: document.querySelector("#chatMessages"),
  questionForm: document.querySelector("#questionForm"),
  questionInput: document.querySelector("#questionInput"),
  historyList: document.querySelector("#historyList"),
  clearHistoryButton: document.querySelector("#clearHistoryButton"),
  totalQuestions: document.querySelector("#totalQuestions"),
  negativeCount: document.querySelector("#negativeCount"),
  humanCheckCount: document.querySelector("#humanCheckCount"),
  unratedCount: document.querySelector("#unratedCount"),
  questionLogList: document.querySelector("#questionLogList"),
  questionLogSearch: document.querySelector("#questionLogSearch"),
  questionLogRatingFilter: document.querySelector("#questionLogRatingFilter"),
  questionLogSourceFilter: document.querySelector("#questionLogSourceFilter"),
  questionLogDateFrom: document.querySelector("#questionLogDateFrom"),
  questionLogDateTo: document.querySelector("#questionLogDateTo"),
  questionLogExportButton: document.querySelector("#questionLogExportButton"),
  departmentInquiryList: document.querySelector("#departmentInquiryList"),
  questionRanking: document.querySelector("#questionRanking"),
  storeUsage: document.querySelector("#storeUsage"),
  wordRanking: document.querySelector("#wordRanking"),
  unresolvedList: document.querySelector("#unresolvedList"),
  knowledgeCards: document.querySelector("#knowledgeCards"),
  knowledgeArea: document.querySelector("#knowledgeArea"),
  knowledgeUpdateForm: document.querySelector("#knowledgeUpdateForm"),
  knowledgeMemo: document.querySelector("#knowledgeMemo"),
  knowledgeHistory: document.querySelector("#knowledgeHistory"),
  knowledgeTestButton: document.querySelector("#knowledgeTestButton"),
  answerRuleForm: document.querySelector("#answerRuleForm"),
  answerRuleName: document.querySelector("#answerRuleName"),
  answerRuleNotebook: document.querySelector("#answerRuleNotebook"),
  answerRulePriority: document.querySelector("#answerRulePriority"),
  answerRuleActive: document.querySelector("#answerRuleActive"),
  answerRuleRisk: document.querySelector("#answerRuleRisk"),
  answerRuleHumanCheck: document.querySelector("#answerRuleHumanCheck"),
  answerRuleKeywords: document.querySelector("#answerRuleKeywords"),
  answerRuleLinkChoices: document.querySelector("#answerRuleLinkChoices"),
  answerRuleAnswer: document.querySelector("#answerRuleAnswer"),
  answerRuleStatus: document.querySelector("#answerRuleStatus"),
  answerRuleSubmitButton: document.querySelector("#answerRuleSubmitButton"),
  answerRuleCancelButton: document.querySelector("#answerRuleCancelButton"),
  answerRuleSearch: document.querySelector("#answerRuleSearch"),
  answerRuleNotebookFilter: document.querySelector("#answerRuleNotebookFilter"),
  answerRuleStatusFilter: document.querySelector("#answerRuleStatusFilter"),
  answerRuleRiskFilter: document.querySelector("#answerRuleRiskFilter"),
  answerRuleList: document.querySelector("#answerRuleList"),
  linkMasterForm: document.querySelector("#linkMasterForm"),
  linkMasterId: document.querySelector("#linkMasterId"),
  linkMasterLabel: document.querySelector("#linkMasterLabel"),
  linkMasterHref: document.querySelector("#linkMasterHref"),
  linkMasterCategory: document.querySelector("#linkMasterCategory"),
  linkMasterOwner: document.querySelector("#linkMasterOwner"),
  linkMasterDescription: document.querySelector("#linkMasterDescription"),
  linkMasterActive: document.querySelector("#linkMasterActive"),
  linkMasterSortOrder: document.querySelector("#linkMasterSortOrder"),
  linkMasterCancelButton: document.querySelector("#linkMasterCancelButton"),
  linkMasterStatus: document.querySelector("#linkMasterStatus"),
  linkMasterList: document.querySelector("#linkMasterList"),
  messageTemplate: document.querySelector("#messageTemplate")
};

let session = authProvider.currentSession();
let adminLogCache = [];
let answerRuleCache = [];
let editingAnswerRuleId = null;
let linkMasterCache = [];
let editingLinkId = null;

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(elements.loginForm);
  try {
    session = await authProvider.login(formData.get("storeId"), formData.get("storePass"));
    elements.loginForm.reset();
    elements.loginError.hidden = true;
    showHub();
  } catch (error) {
    elements.loginError.textContent = error.message;
    elements.loginError.hidden = false;
  }
});

elements.logoutButton.addEventListener("click", () => {
  authProvider.logout();
  session = null;
  elements.chatMessages.innerHTML = "";
  showLogin();
});

elements.adminToggle.addEventListener("click", showAdmin);
elements.backToHubButton.addEventListener("click", showHub);

elements.adminTabs.forEach((button) => {
  button.addEventListener("click", () => {
    switchAdminTab(button.dataset.adminTab);
  });
});

elements.questionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const question = elements.questionInput.value.trim();
  if (!question || !session) return;
  elements.questionInput.value = "";
  await askConcierge(question);
});

document.querySelectorAll("[data-question]").forEach((button) => {
  button.addEventListener("click", async () => {
    if (!session) return;
    await askConcierge(button.dataset.question);
  });
});

elements.clearHistoryButton.addEventListener("click", () => {
  if (!session) return;
  logRepository.clearStore(getSessionLogOwnerId());
  renderHistory();
});

elements.questionLogSearch.addEventListener("input", () => {
  renderQuestionLogList(adminLogCache);
});

elements.questionLogRatingFilter.addEventListener("change", () => {
  renderQuestionLogList(adminLogCache);
});

elements.questionLogSourceFilter.addEventListener("change", () => {
  renderQuestionLogList(adminLogCache);
});

elements.questionLogDateFrom.addEventListener("change", () => {
  renderQuestionLogList(adminLogCache);
});

elements.questionLogDateTo.addEventListener("change", () => {
  renderQuestionLogList(adminLogCache);
});

elements.questionLogExportButton.addEventListener("click", () => {
  exportQuestionLogsCsv(filterQuestionLogs(adminLogCache));
});

elements.answerRuleSearch.addEventListener("input", () => {
  renderAnswerRuleList(answerRuleCache);
});

elements.answerRuleNotebookFilter.addEventListener("change", () => {
  renderAnswerRuleList(answerRuleCache);
});

elements.answerRuleStatusFilter.addEventListener("change", () => {
  renderAnswerRuleList(answerRuleCache);
});

elements.answerRuleRiskFilter.addEventListener("change", () => {
  renderAnswerRuleList(answerRuleCache);
});

elements.answerRuleRisk.addEventListener("change", () => {
  if (elements.answerRuleRisk.value === "high") {
    elements.answerRuleHumanCheck.value = "true";
  }
});

elements.answerRuleCancelButton.addEventListener("click", () => {
  resetAnswerRuleForm();
});

elements.linkMasterCancelButton.addEventListener("click", () => {
  resetLinkMasterForm();
});

elements.knowledgeUpdateForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const area = KNOWLEDGE_AREAS.find((item) => item.id === elements.knowledgeArea.value);
  const memo = elements.knowledgeMemo.value.trim();
  if (!area || !memo || !session?.admin) return;
  const entry = {
    id: crypto.randomUUID(),
    areaId: area.id,
    areaName: area.name,
    owner: area.owner,
    memo,
    updatedBy: session.name,
    phase1LoginId: getPhase1LoginId(),
    createdAt: new Date().toISOString()
  };
  try {
    await knowledgeUpdateRepository.append(entry);
  } catch (error) {
    appendMessage("assistant", `ナレッジ更新履歴の保存に失敗しました: ${error.message || error}`, {
      meta: "管理用メッセージ"
    });
  }
  elements.knowledgeUpdateForm.reset();
  renderKnowledgeHistory();
});

elements.knowledgeTestButton.addEventListener("click", () => {
  showHub();
  elements.questionInput.focus();
});

elements.linkMasterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!editingLinkId) {
    elements.linkMasterStatus.textContent = "一覧から編集するリンクを選択してください。";
    return;
  }

  elements.linkMasterStatus.textContent = "保存中です。";
  try {
    await linkMasterRepository.update({
      id: editingLinkId,
      label: elements.linkMasterLabel.value.trim(),
      href: elements.linkMasterHref.value.trim(),
      category: elements.linkMasterCategory.value.trim(),
      owner: elements.linkMasterOwner.value.trim(),
      description: elements.linkMasterDescription.value.trim(),
      active: elements.linkMasterActive.value,
      sortOrder: Number(elements.linkMasterSortOrder.value || "100")
    });
    resetLinkMasterForm({ keepStatus: true });
    await renderLinkAdmin();
    await renderAnswerRuleLinkChoices();
    elements.linkMasterStatus.textContent = "リンクを更新しました。回答後リンクにも反映されます。";
  } catch (error) {
    elements.linkMasterStatus.textContent = `保存に失敗しました: ${error.message || error}`;
  }
});

elements.answerRuleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const ruleName = elements.answerRuleName.value.trim();
  const keywords = elements.answerRuleKeywords.value.trim();
  const answer = elements.answerRuleAnswer.value.trim();
  if (!ruleName || !keywords || !answer) return;

  elements.answerRuleStatus.textContent = "保存中です。";
  const action = editingAnswerRuleId ? "updateAnswerRule" : "appendAnswerRule";
  const wasEditing = Boolean(editingAnswerRuleId);
  try {
    const result = await requestBackend(action, {
      ruleId: editingAnswerRuleId || createRuleId(ruleName),
      phase1LoginId: getPhase1LoginId(),
      keywords,
      notebook: elements.answerRuleNotebook.value,
      answer,
      linkIds: getSelectedAnswerRuleLinkIds().join(","),
      active: elements.answerRuleActive.value,
      riskLevel: elements.answerRuleRisk.value,
      requiresHumanCheck: elements.answerRuleRisk.value === "high" ? "true" : elements.answerRuleHumanCheck.value,
      priority: elements.answerRulePriority.value || "10"
    });
    if (!result.ok) throw new Error(result.error || "保存できませんでした。");
    answerRuleRepository.clear();
    resetAnswerRuleForm({ keepStatus: true });
    await renderAnswerRuleList();
    elements.answerRuleStatus.textContent = wasEditing
      ? "更新しました。NOV Naviでキーワードを入力して確認できます。"
      : "保存しました。NOV Naviでキーワードを入力して確認できます。";
  } catch (error) {
    elements.answerRuleStatus.textContent = `保存に失敗しました: ${error.message || error}`;
  }
});

if (session) {
  showHub();
} else {
  showLogin();
}

function showLogin() {
  elements.loginView.hidden = false;
  elements.hubView.hidden = true;
  elements.adminView.hidden = true;
  elements.storeBadge.hidden = true;
  elements.logoutButton.hidden = true;
  elements.adminToggle.hidden = true;
}

function showHub() {
  elements.loginView.hidden = true;
  elements.hubView.hidden = false;
  elements.adminView.hidden = true;
  elements.storeBadge.textContent = session.name;
  elements.storeBadge.hidden = false;
  elements.logoutButton.hidden = false;
  elements.adminToggle.hidden = !session.admin;
  renderHistory();
  if (!elements.chatMessages.children.length) {
    addAssistantWelcome();
  }
}

function showAdmin() {
  if (!session?.admin) return;
  elements.loginView.hidden = true;
  elements.hubView.hidden = true;
  elements.adminView.hidden = false;
  switchAdminTab("overview");
  renderAdmin();
  renderKnowledgeAdmin();
  renderLinkAdmin();
  renderAnswerRuleLinkChoices();
  renderAnswerRuleList();
}

function switchAdminTab(tabId = "overview") {
  elements.adminTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.adminTab === tabId);
    button.setAttribute("aria-selected", button.dataset.adminTab === tabId ? "true" : "false");
  });
  elements.adminPanels.forEach((panel) => {
    panel.hidden = panel.dataset.adminPanel !== tabId;
  });
}

async function askConcierge(question) {
  appendMessage("user", question);
  const pending = appendMessage("assistant", "確認しています。必要な情報、申請、アプリへの導線を整理します。");
  const response = await knowledgeAdapter.ask({ question, store: session });
  const logId = crypto.randomUUID();
  const resolvedLinks = await linkMasterRepository.resolve(response.links || []);
  const displayLinks = resolvedLinks.map((link) => ({
    ...link,
    question,
    questionLogId: logId
  }));
  const entry = {
    id: logId,
    createdAt: new Date().toISOString(),
    storeId: getSessionLogOwnerId(),
    storeUuid: session.storeId,
    phase1LoginId: getPhase1LoginId(),
    storeName: session.storeName || session.name,
    question,
    answer: response.answer,
    notebook: response.notebook,
    links: resolvedLinks,
    source: response.confidence === "rule-master" ? "rule" : "fallback",
    riskLevel: response.riskLevel || "normal",
    needsHumanCheck: Boolean(response.requiresHumanCheck || response.riskLevel === "high" || response.confidence === "low"),
    rating: null
  };
  try {
    await logRepository.append(entry);
  } catch (error) {
    console.warn("Failed to sync log", error);
    appendMessage("assistant", `ログ保存に失敗しました: ${error.message || error}`, {
      meta: "管理用メッセージ"
    });
  }
  pending.remove();
  appendMessage("assistant", response.answer, {
    meta: response.notebook,
    links: displayLinks,
    riskLevel: response.riskLevel,
    requiresHumanCheck: response.requiresHumanCheck || response.confidence === "low",
    feedbackId: entry.id
  });
  renderHistory();
}

function addAssistantWelcome() {
  appendMessage(
    "assistant",
    "NOV Naviです。社内資料を探す前に、まずここで自然に聞いてください。必要に応じて申請フォーム、社内資料、各種アプリへ案内します。",
    { meta: "社内OS入口" }
  );
}

function appendMessage(role, text, options = {}) {
  const node = elements.messageTemplate.content.firstElementChild.cloneNode(true);
  node.classList.add(role);
  const bubble = node.querySelector(".message-bubble");

  if (options.meta) {
    const meta = document.createElement("span");
    meta.className = "message-meta";
    meta.textContent = options.meta;
    bubble.append(meta);
  }

  bubble.append(document.createTextNode(text));

  if (options.links?.length) {
    const linkList = document.createElement("div");
    linkList.className = "link-list";
    options.links.forEach((link) => {
      const departmentRouteId = LINK_DEPARTMENT_ROUTES[link.id];
      if (departmentRouteId) {
        linkList.append(createDepartmentInquiryButton(link, departmentRouteId));
        return;
      }

      const anchor = document.createElement("a");
      anchor.href = link.href;
      anchor.textContent = `${link.label} >`;
      anchor.setAttribute("aria-label", `${link.label}を開く`);
      linkList.append(anchor);
    });
    bubble.append(linkList);
  }

  if (shouldShowHumanCheckNotice(options)) {
    const notice = document.createElement("div");
    notice.className = "human-check-notice";
    notice.textContent = "この内容は本部確認や正本資料の確認を優先してください。判断に迷う場合は、関連リンクまたは担当窓口へ進んでください。";
    bubble.append(notice);
  }

  if (options.feedbackId) {
    bubble.append(createFeedback(options.feedbackId));
  }

  elements.chatMessages.append(node);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  return node;
}

function createDepartmentInquiryButton(link, routeId) {
  const wrapper = document.createElement("div");
  wrapper.className = "department-inquiry";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "department-inquiry-button";
  button.textContent = `${link.label} >`;
  button.setAttribute("aria-label", `${link.label}へ問い合わせる`);
  wrapper.append(button);

  const form = document.createElement("form");
  form.className = "department-inquiry-form";
  form.hidden = true;

  const textarea = document.createElement("textarea");
  textarea.rows = 4;
  textarea.placeholder = "問い合わせ内容を入力";
  textarea.value = link.question ? `質問内容: ${link.question}\n\n相談内容: ` : "";
  form.append(textarea);

  const actions = document.createElement("div");
  actions.className = "department-inquiry-actions";

  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.className = "primary-button";
  submitButton.textContent = "送信";
  actions.append(submitButton);

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "text-button";
  cancelButton.textContent = "キャンセル";
  actions.append(cancelButton);

  const status = document.createElement("p");
  status.className = "save-status";
  status.setAttribute("role", "status");

  form.append(actions);
  form.append(status);
  wrapper.append(form);

  button.addEventListener("click", () => {
    form.hidden = !form.hidden;
    if (!form.hidden) textarea.focus();
  });

  cancelButton.addEventListener("click", () => {
    form.hidden = true;
    status.textContent = "";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = textarea.value.trim();
    if (!body) {
      status.textContent = "問い合わせ内容を入力してください。";
      return;
    }

    submitButton.disabled = true;
    button.textContent = "送信中";
    status.textContent = "送信中です。";
    try {
      const result = await departmentInquiryRepository.create({
        routeId,
        questionLogId: link.questionLogId,
        subject: link.question || link.label,
        body
      });
      const routeName = result.routeName || link.label;
      const delivery = result.delivery === "queued" ? "担当部門への通知待ちに登録しました。" : "問い合わせ履歴に保存しました。";
      appendMessage("assistant", `${routeName}への問い合わせを受け付けました。${delivery}`, {
        meta: "問い合わせ受付"
      });
      form.hidden = true;
      button.textContent = "受付済み";
      button.disabled = true;
    } catch (error) {
      console.warn("Failed to create department inquiry", error);
      button.textContent = `${link.label} >`;
      status.textContent = `受付に失敗しました: ${error.message || error}`;
    } finally {
      submitButton.disabled = false;
    }
  });

  return wrapper;
}

function createFeedback(logId) {
  const wrapper = document.createElement("div");
  wrapper.className = "feedback";

  const label = document.createElement("span");
  label.textContent = "この回答は役に立ちましたか？";
  wrapper.append(label);

  const status = document.createElement("span");
  status.className = "feedback-status";
  status.setAttribute("aria-live", "polite");

  [
    { rating: "up", label: "役に立った" },
    { rating: "down", label: "改善が必要" }
  ].forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item.label;
    button.addEventListener("click", async () => {
      const buttons = Array.from(wrapper.querySelectorAll("button"));
      buttons.forEach((current) => {
        current.classList.toggle("selected", current === button);
        current.disabled = true;
      });
      wrapper.dataset.state = "saving";
      status.textContent = "保存中";

      try {
        await logRepository.updateRating(logId, item.rating);
        wrapper.dataset.state = "saved";
        status.textContent = "保存しました";
      } catch (error) {
        console.warn("Failed to sync rating", error);
        wrapper.dataset.state = "error";
        status.textContent = "保存できませんでした";
        button.classList.remove("selected");
        appendMessage("assistant", `評価保存に失敗しました: ${error.message || error}`, {
          meta: "管理用メッセージ"
        });
      } finally {
        buttons.forEach((current) => {
          current.disabled = false;
        });
      }
      if (elements.adminView.hidden === false) renderAdmin();
    });
    wrapper.append(button);
  });

  wrapper.append(status);
  return wrapper;
}

function renderHistory() {
  const ownerId = getSessionLogOwnerId();
  const storeLogs = logRepository.all().filter((entry) => entry.storeId === ownerId);
  elements.historyList.innerHTML = "";

  if (!storeLogs.length) {
    elements.historyList.innerHTML = '<div class="history-item">まだ質問履歴はありません。</div>';
    return;
  }

  storeLogs.slice(0, 20).forEach((entry) => {
    const item = document.createElement("article");
    item.className = "history-item";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = entry.question;
    button.addEventListener("click", () => {
      appendMessage("user", entry.question);
      appendMessage("assistant", entry.answer, {
        meta: entry.notebook,
        links: entry.links,
        riskLevel: entry.riskLevel,
        requiresHumanCheck: entry.needsHumanCheck,
        feedbackId: entry.id
      });
    });
    const time = document.createElement("time");
    time.dateTime = entry.createdAt;
    time.textContent = formatDate(entry.createdAt);
    item.append(button, time);
    elements.historyList.append(item);
  });
}

async function renderAdmin() {
  elements.totalQuestions.textContent = "...";
  elements.negativeCount.textContent = "...";
  elements.humanCheckCount.textContent = "...";
  elements.unratedCount.textContent = "...";
  renderRanking(elements.questionRanking, []);
  renderRanking(elements.storeUsage, []);
  renderRanking(elements.wordRanking, []);
  elements.questionLogList.innerHTML = '<div class="question-log-item">読み込み中です。</div>';
  elements.departmentInquiryList.innerHTML = '<div class="department-inquiry-item">読み込み中です。</div>';
  elements.unresolvedList.innerHTML = '<div class="issue-item">読み込み中です。</div>';

  const logs = await logRepository.allForAdmin();
  adminLogCache = logs;
  const negativeLogs = logs.filter((entry) => entry.rating === "down");
  const humanCheckLogs = logs.filter((entry) => entry.needsHumanCheck || entry.riskLevel === "high");
  const unratedLogs = logs.filter((entry) => !entry.rating);

  elements.totalQuestions.textContent = String(logs.length);
  elements.negativeCount.textContent = String(negativeLogs.length);
  elements.humanCheckCount.textContent = String(humanCheckLogs.length);
  elements.unratedCount.textContent = String(unratedLogs.length);

  renderRanking(elements.questionRanking, countBy(logs, (entry) => entry.question));
  renderRanking(elements.storeUsage, countBy(logs, (entry) => entry.storeName || entry.phase1LoginId || entry.storeId));
  renderRanking(elements.wordRanking, countWords(logs));
  renderQuestionLogList(adminLogCache);
  renderIssues(prioritizeIssues(logs).slice(0, 20));
  renderDepartmentInquiries();
}

function renderQuestionLogList(logs) {
  elements.questionLogList.innerHTML = "";
  const filteredLogs = filterQuestionLogs(logs);
  if (!logs.length) {
    elements.questionLogList.innerHTML = '<div class="question-log-item">まだ質問ログはありません。</div>';
    return;
  }
  if (!filteredLogs.length) {
    elements.questionLogList.innerHTML = '<div class="question-log-item">条件に合う質問ログはありません。</div>';
    return;
  }

  filteredLogs.slice(0, 30).forEach((entry) => {
    const item = document.createElement("article");
    item.className = "question-log-item";

    const head = document.createElement("div");
    head.className = "question-log-head";

    const question = document.createElement("strong");
    question.textContent = entry.question;

    const rating = document.createElement("span");
    rating.className = `question-log-rating ${entry.rating || "none"}`;
    rating.textContent = entry.needsHumanCheck ? `${formatRating(entry.rating)} / 要確認` : formatRating(entry.rating);

    head.append(question, rating);

    const meta = document.createElement("small");
    meta.textContent = `${formatDate(entry.createdAt)} / ${entry.storeName || entry.storeId || "不明"} / ${entry.notebook || "分類なし"} / ${formatLogSource(entry.source)} / ${formatRiskLevel(entry.riskLevel)}`;

    const answer = document.createElement("p");
    answer.textContent = entry.answer || "回答なし";

    item.append(head, meta, answer);
    elements.questionLogList.append(item);
  });
}

async function renderDepartmentInquiries() {
  elements.departmentInquiryList.innerHTML = '<div class="department-inquiry-item">読み込み中です。</div>';
  try {
    const inquiries = await departmentInquiryRepository.allForAdmin();
    elements.departmentInquiryList.innerHTML = "";
    if (!inquiries.length) {
      elements.departmentInquiryList.innerHTML = '<div class="department-inquiry-item">まだ部門問い合わせはありません。</div>';
      return;
    }

    inquiries.slice(0, 30).forEach((entry) => {
      const item = document.createElement("article");
      item.className = "department-inquiry-item";

      const head = document.createElement("div");
      head.className = "question-log-head";

      const title = document.createElement("strong");
      title.textContent = `${entry.routeName || entry.routeId} / ${entry.subject || "問い合わせ"}`;

      const status = document.createElement("span");
      status.className = `inquiry-status ${entry.status || "queued"}`;
      status.textContent = formatInquiryStatus(entry.status);
      head.append(title, status);

      const meta = document.createElement("small");
      const notificationText = entry.notificationConfigured
        ? `通知先: ${entry.notificationChannelName || "設定済み"}`
        : "通知先未設定";
      meta.textContent = `${formatDate(entry.createdAt)} / ${entry.storeName || entry.phase1LoginId || "不明"} / ${notificationText}`;

      const body = document.createElement("p");
      body.textContent = entry.inquiryText || "";

      item.append(head, meta, body);
      elements.departmentInquiryList.append(item);
    });
  } catch (error) {
    elements.departmentInquiryList.innerHTML = `<div class="department-inquiry-item">問い合わせログを取得できませんでした: ${error.message || error}</div>`;
  }
}

function formatInquiryStatus(status) {
  if (status === "notified") return "通知済み";
  if (status === "failed") return "失敗";
  if (status === "resolved") return "対応済み";
  if (status === "cancelled") return "取消";
  return "通知待ち";
}

function filterQuestionLogs(logs) {
  const keyword = elements.questionLogSearch.value.trim().toLowerCase();
  const ratingFilter = elements.questionLogRatingFilter.value;
  const sourceFilter = elements.questionLogSourceFilter.value;
  const dateFrom = elements.questionLogDateFrom.value ? new Date(`${elements.questionLogDateFrom.value}T00:00:00`) : null;
  const dateTo = elements.questionLogDateTo.value ? new Date(`${elements.questionLogDateTo.value}T23:59:59`) : null;

  return logs.filter((entry) => {
    const rating = entry.rating || "none";
    if (ratingFilter !== "all" && rating !== ratingFilter) return false;
    if (sourceFilter !== "all" && (entry.source || "rule") !== sourceFilter) return false;
    const createdAt = entry.createdAt ? new Date(entry.createdAt) : null;
    if (dateFrom && (!createdAt || createdAt < dateFrom)) return false;
    if (dateTo && (!createdAt || createdAt > dateTo)) return false;
    if (!keyword) return true;

    const searchableText = [
      entry.question,
      entry.answer,
      entry.storeName,
      entry.storeId,
      entry.notebook,
      formatRating(entry.rating)
    ].join(" ").toLowerCase();

    return searchableText.includes(keyword);
  });
}

function exportQuestionLogsCsv(logs) {
  if (!logs.length) {
    elements.questionLogList.innerHTML = '<div class="question-log-item">出力できる質問ログがありません。</div>';
    return;
  }

  const headers = ["日時", "店舗", "店舗ID", "質問", "回答", "Notebook", "評価", "取得元", "リスク", "要確認"];
  const rows = logs.map((entry) => [
    formatDateTimeForCsv(entry.createdAt),
    entry.storeName || "",
    entry.phase1LoginId || entry.storeId || "",
    entry.question || "",
    entry.answer || "",
    entry.notebook || "",
    formatRating(entry.rating),
    formatLogSource(entry.source),
    formatRiskLevel(entry.riskLevel),
    entry.needsHumanCheck ? "必要" : ""
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `nov-navi-question-logs-${formatDateForFileName(new Date())}.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function formatDateTimeForCsv(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDateForFileName(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function formatRating(rating) {
  if (rating === "up") return "役に立った";
  if (rating === "down") return "改善が必要";
  return "未評価";
}

function formatLogSource(source) {
  if (source === "fallback") return "未整備候補";
  if (source === "manual") return "手動";
  if (source === "ai_adapter") return "AI連携";
  return "回答ルール";
}

function formatRiskLevel(riskLevel) {
  if (riskLevel === "high") return "高";
  if (riskLevel === "sensitive") return "注意";
  return "通常";
}

function shouldShowHumanCheckNotice(options) {
  return Boolean(
    options.requiresHumanCheck ||
    options.riskLevel === "high" ||
    options.riskLevel === "sensitive"
  );
}

function renderKnowledgeAdmin() {
  renderKnowledgeCards();
  renderKnowledgeOptions();
  renderKnowledgeHistory();
}

async function renderAnswerRuleLinkChoices() {
  const linkMaster = await linkMasterRepository.all();
  const links = Object.values(linkMaster)
    .filter((link) => isLinkActive(link.active))
    .sort((a, b) => String(a.category || "").localeCompare(String(b.category || "")) || a.label.localeCompare(b.label));

  elements.answerRuleLinkChoices.innerHTML = "";
  if (!links.length) {
    elements.answerRuleLinkChoices.innerHTML = '<span class="empty-inline">選択できるリンクがありません。</span>';
    return;
  }

  links.forEach((link) => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = link.id;
    const text = document.createElement("span");
    text.textContent = link.label;
    label.append(checkbox, text);
    elements.answerRuleLinkChoices.append(label);
  });
}

function getSelectedAnswerRuleLinkIds() {
  return Array.from(elements.answerRuleLinkChoices.querySelectorAll("input:checked")).map((input) => input.value);
}

async function renderLinkAdmin() {
  const linkMaster = await linkMasterRepository.all();
  linkMasterCache = Object.values(linkMaster)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || String(a.label || "").localeCompare(String(b.label || "")));

  elements.linkMasterList.innerHTML = "";
  if (!linkMasterCache.length) {
    elements.linkMasterList.innerHTML = '<div class="link-master-item">登録済みリンクはありません。</div>';
    return;
  }

  linkMasterCache.forEach((link) => {
    const item = document.createElement("article");
    item.className = "link-master-item";

    const title = document.createElement("strong");
    title.textContent = link.label;

    const meta = document.createElement("span");
    meta.textContent = `${link.id} / ${link.category || "未分類"} / ${isLinkActive(link.active) ? "有効" : "停止"}`;

    const href = document.createElement("a");
    href.href = link.href;
    href.target = "_blank";
    href.rel = "noreferrer";
    href.textContent = link.href;

    const actions = document.createElement("div");
    actions.className = "rule-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "text-button";
    editButton.textContent = "編集";
    editButton.addEventListener("click", () => {
      populateLinkMasterForm(link);
    });

    actions.append(editButton);
    item.append(title, meta, href, actions);
    elements.linkMasterList.append(item);
  });
}

function populateLinkMasterForm(link) {
  editingLinkId = link.id;
  elements.linkMasterId.value = link.id;
  elements.linkMasterLabel.value = link.label || "";
  elements.linkMasterHref.value = link.href || "";
  elements.linkMasterCategory.value = link.category || "";
  elements.linkMasterOwner.value = link.owner || "";
  elements.linkMasterDescription.value = link.description || "";
  elements.linkMasterActive.value = isLinkActive(link.active) ? "有効" : "停止";
  elements.linkMasterSortOrder.value = link.sortOrder || "100";
  elements.linkMasterCancelButton.hidden = false;
  elements.linkMasterStatus.textContent = "編集中です。URLと表示名を確認して更新してください。";
  elements.linkMasterHref.focus();
}

function resetLinkMasterForm(options = {}) {
  editingLinkId = null;
  elements.linkMasterForm.reset();
  elements.linkMasterId.value = "";
  elements.linkMasterActive.value = "有効";
  elements.linkMasterSortOrder.value = "100";
  elements.linkMasterCancelButton.hidden = true;
  if (!options.keepStatus) {
    elements.linkMasterStatus.textContent = "";
  }
}

async function renderAnswerRuleList(rules = null) {
  if (!rules) {
    answerRuleCache = await answerRuleRepository.all({ includeInactive: true });
  }
  const sourceRules = rules || answerRuleCache;
  const filteredRules = filterAnswerRules(sourceRules);
  elements.answerRuleList.innerHTML = "";

  if (!sourceRules.length) {
    elements.answerRuleList.innerHTML = '<div class="rule-list-item">登録済み回答ルールはありません。</div>';
    return;
  }
  if (!filteredRules.length) {
    elements.answerRuleList.innerHTML = '<div class="rule-list-item">条件に合う回答ルールはありません。</div>';
    return;
  }

  filteredRules.forEach((rule) => {
    const item = document.createElement("article");
    item.className = "rule-list-item";

    const title = document.createElement("strong");
    title.textContent = rule.id;

    const meta = document.createElement("span");
    meta.textContent = `${rule.notebook} / 優先度: ${rule.priority} / ${formatRiskLevel(rule.riskLevel)}${rule.requiresHumanCheck ? " / 本部確認" : ""} / ${isRuleActive(rule.active) ? "有効" : "停止"}`;

    const keywords = document.createElement("span");
    keywords.textContent = `キーワード: ${rule.keywords.join(", ")}`;

    const answer = document.createElement("p");
    answer.textContent = rule.answer;

    const actions = document.createElement("div");
    actions.className = "rule-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "text-button";
    editButton.textContent = "編集";
    editButton.addEventListener("click", () => {
      populateAnswerRuleForm(rule);
    });

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "text-button";
    toggleButton.textContent = isRuleActive(rule.active) ? "停止" : "再開";
    toggleButton.addEventListener("click", async () => {
      await updateAnswerRuleActive(rule, isRuleActive(rule.active) ? "停止" : "有効");
    });

    actions.append(editButton, toggleButton);
    item.append(title, meta, keywords, answer, actions);
    elements.answerRuleList.append(item);
  });
}

function populateAnswerRuleForm(rule) {
  editingAnswerRuleId = rule.id;
  elements.answerRuleName.value = rule.id;
  elements.answerRuleName.disabled = true;
  elements.answerRuleKeywords.value = (rule.keywords || []).join(",");
  elements.answerRuleNotebook.value = rule.notebook || "Notebook① スタッフサポート";
  elements.answerRulePriority.value = rule.priority || "10";
  elements.answerRuleActive.value = isRuleActive(rule.active) ? "有効" : "停止";
  elements.answerRuleRisk.value = rule.riskLevel || "normal";
  elements.answerRuleHumanCheck.value = rule.requiresHumanCheck || rule.riskLevel === "high" ? "true" : "false";
  elements.answerRuleAnswer.value = rule.answer || "";
  elements.answerRuleSubmitButton.textContent = "回答ルールを更新";
  elements.answerRuleCancelButton.hidden = false;
  elements.answerRuleStatus.textContent = "編集中です。内容を確認して更新してください。";

  elements.answerRuleLinkChoices.querySelectorAll("input").forEach((input) => {
    input.checked = (rule.linkIds || []).includes(input.value);
  });
  elements.answerRuleAnswer.focus();
}

function resetAnswerRuleForm(options = {}) {
  editingAnswerRuleId = null;
  elements.answerRuleForm.reset();
  elements.answerRuleName.disabled = false;
  elements.answerRulePriority.value = "10";
  elements.answerRuleActive.value = "有効";
  elements.answerRuleRisk.value = "normal";
  elements.answerRuleHumanCheck.value = "false";
  elements.answerRuleSubmitButton.textContent = "回答ルールを追加";
  elements.answerRuleCancelButton.hidden = true;
  elements.answerRuleLinkChoices.querySelectorAll("input:checked").forEach((input) => {
    input.checked = false;
  });
  if (!options.keepStatus) {
    elements.answerRuleStatus.textContent = "";
  }
}

async function updateAnswerRuleActive(rule, active) {
  elements.answerRuleStatus.textContent = `${rule.id} を${active === "有効" ? "再開" : "停止"}しています。`;
  const result = await requestBackend("updateAnswerRule", {
    ruleId: rule.id,
    keywords: (rule.keywords || []).join(","),
    notebook: rule.notebook,
    answer: rule.answer,
    linkIds: (rule.linkIds || []).join(","),
    active,
    riskLevel: rule.riskLevel || "normal",
    requiresHumanCheck: rule.requiresHumanCheck || rule.riskLevel === "high" ? "true" : "false",
    priority: String(rule.priority || "10")
  });
  if (!result.ok) {
    elements.answerRuleStatus.textContent = `更新に失敗しました: ${result.error || "保存できませんでした。"}`;
    return;
  }
  answerRuleRepository.clear();
  resetAnswerRuleForm({ keepStatus: true });
  await renderAnswerRuleList();
  elements.answerRuleStatus.textContent = `${rule.id} を${active === "有効" ? "再開" : "停止"}しました。`;
}

function filterAnswerRules(rules) {
  const keyword = elements.answerRuleSearch.value.trim().toLowerCase();
  const notebook = elements.answerRuleNotebookFilter.value;
  const status = elements.answerRuleStatusFilter.value;
  const risk = elements.answerRuleRiskFilter.value;

  return rules.filter((rule) => {
    if (notebook !== "all" && rule.notebook !== notebook) return false;
    if (status === "active" && !isRuleActive(rule.active)) return false;
    if (status === "inactive" && isRuleActive(rule.active)) return false;
    if (risk === "human-check" && !rule.requiresHumanCheck) return false;
    if (risk !== "all" && risk !== "human-check" && (rule.riskLevel || "normal") !== risk) return false;
    if (!keyword) return true;

    const searchableText = [
      rule.id,
      rule.notebook,
      rule.answer,
      ...(rule.keywords || []),
      ...(rule.linkIds || [])
    ].join(" ").toLowerCase();

    return searchableText.includes(keyword);
  });
}

function renderKnowledgeCards() {
  elements.knowledgeCards.innerHTML = "";
  KNOWLEDGE_AREAS.forEach((area) => {
    const card = document.createElement("article");
    card.className = "knowledge-card";

    const title = document.createElement("h4");
    title.textContent = area.name;
    const description = document.createElement("p");
    description.textContent = `${area.notebook} / ${area.owner} / ${area.description}`;

    const actions = document.createElement("div");
    actions.className = "knowledge-actions";
    const source = document.createElement("a");
    source.href = area.sourceHref;
    source.textContent = "正本資料を開く";
    const notebook = document.createElement("a");
    notebook.href = area.notebookHref;
    notebook.target = "_blank";
    notebook.rel = "noreferrer";
    notebook.textContent = "NotebookLM管理";
    actions.append(source, notebook);

    card.append(title, description, actions);
    elements.knowledgeCards.append(card);
  });
}

function renderKnowledgeOptions() {
  elements.knowledgeArea.innerHTML = "";
  KNOWLEDGE_AREAS.forEach((area) => {
    const option = document.createElement("option");
    option.value = area.id;
    option.textContent = `${area.name}（${area.owner}）`;
    elements.knowledgeArea.append(option);
  });
}

async function renderKnowledgeHistory() {
  const updates = (await knowledgeUpdateRepository.allForAdmin()).filter(isDisplayableKnowledgeUpdate);
  elements.knowledgeHistory.innerHTML = "";
  if (!updates.length) {
    elements.knowledgeHistory.innerHTML = '<div class="knowledge-history-item">まだ更新履歴はありません。</div>';
    return;
  }

  updates.slice(0, 12).forEach((entry) => {
    const item = document.createElement("article");
    item.className = "knowledge-history-item";
    const title = document.createElement("strong");
    title.textContent = `${entry.areaName}: ${entry.memo}`;
    const meta = document.createElement("small");
    meta.textContent = `${entry.owner} / ${entry.updatedBy} / ${formatDate(entry.createdAt)}`;
    item.append(title, meta);
    elements.knowledgeHistory.append(item);
  });
}

function isDisplayableKnowledgeUpdate(entry) {
  const text = [entry.areaName, entry.memo, entry.owner, entry.updatedBy, entry.source].join(" ");
  if (/codex/i.test(text)) return false;
  if (/\?{4,}/.test(text)) return false;
  return Boolean(String(entry.memo || "").trim());
}

function renderRanking(target, items) {
  target.innerHTML = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = "データなし";
    target.append(li);
    return;
  }

  items.slice(0, 8).forEach(([label, count]) => {
    const li = document.createElement("li");
    li.textContent = `${label}（${count}件）`;
    target.append(li);
  });
}

function renderIssues(items) {
  elements.unresolvedList.innerHTML = "";
  if (!items.length) {
    elements.unresolvedList.innerHTML = '<div class="issue-item">データなし</div>';
    return;
  }

  items.forEach((entry) => {
    const item = document.createElement("article");
    item.className = "issue-item";
    const question = document.createElement("div");
    question.textContent = entry.question;
    const small = document.createElement("small");
    small.textContent = `${entry.storeName || entry.phase1LoginId || "不明"} / ${formatIssueReason(entry)} / ${formatDate(entry.createdAt)}`;
    const action = document.createElement("button");
    action.type = "button";
    action.className = "text-button issue-action";
    action.textContent = "回答ルールに反映";
    action.addEventListener("click", () => {
      populateAnswerRuleFromIssue(entry);
    });
    item.append(question, small, action);
    elements.unresolvedList.append(item);
  });
}

function prioritizeIssues(logs) {
  return logs
    .filter((entry) => entry.needsHumanCheck || entry.riskLevel === "high" || entry.rating === "down" || !entry.rating)
    .sort((a, b) => {
      const scoreDiff = issueScore(b) - issueScore(a);
      if (scoreDiff) return scoreDiff;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
}

function issueScore(entry) {
  let score = 0;
  if (entry.needsHumanCheck) score += 8;
  if (entry.riskLevel === "high") score += 6;
  if (entry.rating === "down") score += 4;
  if (!entry.rating) score += 1;
  return score;
}

function formatIssueReason(entry) {
  const reasons = [];
  if (entry.needsHumanCheck || entry.riskLevel === "high") reasons.push("要確認");
  if (entry.rating === "down") reasons.push("低評価");
  if (!entry.rating) reasons.push("未評価");
  if (!reasons.length) reasons.push(formatRiskLevel(entry.riskLevel));
  return reasons.join(" / ");
}

function populateAnswerRuleFromIssue(entry) {
  elements.answerRuleName.value = entry.question.slice(0, 24);
  elements.answerRuleKeywords.value = entry.question;
  elements.answerRuleNotebook.value = entry.notebook || "Notebook① スタッフサポート";
  elements.answerRulePriority.value = "20";
  elements.answerRuleAnswer.focus();
  elements.answerRuleStatus.textContent = "質問内容を反映しました。回答文を入力してください。";
}

function findRoute(normalizedQuestion) {
  const routes = [
    {
      keywords: ["引っ越", "住所", "交通費", "転居"],
      notebook: "Notebook① スタッフサポート",
      confidence: "high",
      answer: (storeName) => `${storeName}の住所変更ですね。まず住所変更フォームを提出し、通勤経路が変わる場合は交通費変更フォームも提出してください。迷う場合は総務人事へ相談してください。`,
      links: [
        { id: "address-change", label: "住所変更フォーム" },
        { id: "commuting-cost", label: "交通費変更フォーム" },
        { id: "hr-contact", label: "総務問い合わせ" }
      ]
    },
    {
      keywords: ["結婚", "慶弔", "姓", "扶養"],
      notebook: "Notebook① スタッフサポート",
      confidence: "high",
      answer: () => "結婚に関する手続きは、氏名変更、扶養、慶弔申請、給与口座名義の確認が必要になる場合があります。該当する申請を順番に進めてください。",
      links: [
        { id: "celebration-condolence", label: "慶弔申請" },
        { id: "family-name", label: "氏名・扶養変更" },
        { id: "hr-contact", label: "総務問い合わせ" }
      ]
    },
    {
      keywords: ["有休", "有給", "休暇"],
      notebook: "Notebook① スタッフサポート",
      confidence: "medium",
      answer: () => "有休は店舗運営に支障が出ないよう店長へ相談し、勤怠・申請ルールに沿って申請します。残数確認はPhase3で勤怠DB連携予定です。",
      links: [
        { id: "paid-leave", label: "有休申請" },
        { id: "attendance", label: "勤怠アプリ" }
      ]
    },
    {
      keywords: ["給与", "給料", "明細", "社会保険"],
      notebook: "Notebook① スタッフサポート",
      confidence: "medium",
      answer: () => "給与・明細・社会保険はスタッフサポート領域です。支給日、控除、社会保険の確認は関連資料を確認し、不明点は総務人事へ問い合わせてください。",
      links: [
        { id: "payroll", label: "給与ルール" },
        { id: "insurance", label: "社会保険" },
        { id: "hr-contact", label: "総務問い合わせ" }
      ]
    },
    {
      keywords: ["勤怠", "打刻", "遅刻", "早退"],
      notebook: "Notebook① スタッフサポート",
      confidence: "high",
      answer: () => "勤怠の打刻漏れ、遅刻、早退は店長へ共有したうえで勤怠アプリから修正申請してください。緊急時は店舗責任者の指示を優先します。",
      links: [
        { id: "attendance", label: "勤怠アプリ" },
        { id: "timecard-fix", label: "打刻修正申請" }
      ]
    },
    {
      keywords: ["退職", "辞め", "退社"],
      notebook: "Notebook① スタッフサポート",
      confidence: "medium",
      answer: () => "退職相談は一人で判断せず、まず店長または本部相談窓口へ連絡してください。退職手続き、貸与物、最終給与などは順番に案内します。",
      links: [
        { id: "retirement-contact", label: "退職相談窓口" },
        { id: "hr-contact", label: "総務問い合わせ" }
      ]
    },
    {
      keywords: ["評価", "面談", "育成"],
      notebook: "Notebook③ 管理者",
      confidence: "medium",
      answer: () => "評価制度や面談は管理者領域の資料に基づいて案内します。評価基準、面談記録、育成計画を確認してください。",
      links: [
        { id: "evaluation", label: "評価制度" },
        { id: "one-on-one", label: "面談シート" }
      ]
    },
    {
      keywords: ["教育", "技術", "接客", "カウンセリング"],
      notebook: "Notebook② 教育",
      confidence: "high",
      answer: () => "教育に関する内容は、技術マニュアル、接客、カウンセリング、動画文字起こしから案内します。知りたい技術名や場面を入れると絞り込めます。",
      links: [
        { id: "education", label: "教育資料" },
        { id: "technical-manual", label: "技術マニュアル" }
      ]
    }
  ];

  return routes.find((route) => route.keywords.some((keyword) => normalizedQuestion.includes(keyword))) || {
    notebook: "Notebook① スタッフサポート",
    confidence: "low",
    riskLevel: "sensitive",
    requiresHumanCheck: true,
    answer: () => "関連しそうな社内情報を確認します。現時点では確定回答に必要な情報が不足しています。申請、勤怠、給与、教育、評価など目的を少し具体的に入れてください。",
    links: [
      { id: "hr-contact", label: "総務問い合わせ" },
      { id: "apps", label: "社内アプリ一覧" }
    ]
  };
}

function countBy(items, selector) {
  return Object.entries(items.reduce((accumulator, item) => {
    const key = selector(item) || "未設定";
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {})).sort((a, b) => b[1] - a[1]);
}

function countWords(logs) {
  const stopWords = new Set(["した", "です", "ます", "ますか", "ください", "について"]);
  const counts = {};
  logs.forEach((entry) => {
    entry.question
      .replace(/[、。,.!?！？]/g, " ")
      .split(/\s+|(?=[有休給与勤怠評価教育退職結婚引越住所交通費])/)
      .flatMap((part) => part.length > 8 ? part.match(/.{1,4}/g) : [part])
      .filter(Boolean)
      .filter((word) => word.length >= 2 && !stopWords.has(word))
      .forEach((word) => {
        counts[word] = (counts[word] || 0) + 1;
      });
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function isLinkActive(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return true;
  return !["false", "0", "no", "n", "停止", "無効", "不可", "inactive"].includes(normalized);
}

function isRuleActive(value) {
  return isLinkActive(value);
}

function getPhase1LoginId() {
  if (!session || session.source === "hub-context") return "";
  return session.phase1LoginId || session.id || "";
}

function getSessionLogOwnerId() {
  return session?.phase1LoginId || session?.employeeId || session?.id || "";
}

function readHubContext() {
  const runtimeContext = readHubRuntimeContext();
  if (runtimeContext) return runtimeContext;

  for (const key of HUB_CONTEXT_STORAGE_KEYS) {
    const storedContext = readJson(key, null);
    if (storedContext) return storedContext;
  }

  return null;
}

function readHubRuntimeContext() {
  try {
    if (window.NovHubContext?.read) return window.NovHubContext.read();
    if (window.NOV_HUB_CONTEXT) return window.NOV_HUB_CONTEXT;
    if (window.IdeaNovHubContext) return window.IdeaNovHubContext;
  } catch {
    return null;
  }
  return null;
}

function normalizeHubSession(context) {
  const employee = context.employee || {};
  const roleKeys = normalizeStringArray(context.roleKeys || context.roles || employee.roleKeys || employee.roles);
  const selectedStore = selectHubStore(context);
  const token = firstString(
    context.novNaviSessionToken,
    context.conciergeSessionToken,
    context.sessionToken,
    context.token
  );
  const employeeId = firstString(context.employeeId, employee.id, context.employee_id);
  const email = firstString(context.email, employee.email);
  const displayName = firstString(context.displayName, context.name, employee.displayName, employee.name, email);

  return {
    id: employeeId || email || "hub-user",
    employeeId,
    email,
    storeId: selectedStore.id || selectedStore.storeId || firstString(context.storeId, context.activeStoreId),
    phase1LoginId: "",
    name: displayName || "HUBユーザー",
    storeName: selectedStore.name || selectedStore.storeName || "",
    admin: hasHubAdminRole(roleKeys),
    roleKeys,
    jobTypeId: firstString(context.jobTypeId, employee.jobTypeId, employee.job_type_id),
    token,
    source: "hub-context",
    loginAt: new Date().toISOString()
  };
}

function selectHubStore(context) {
  const assignments = normalizeStoreAssignments(context.storeAssignments || context.stores || context.assignedStores);
  const activeStoreId = firstString(context.activeStoreId, context.storeId, context.store?.id);
  if (!assignments.length) return context.store || {};
  return assignments.find((store) => {
    return store.id === activeStoreId || store.storeId === activeStoreId || store.store_id === activeStoreId;
  }) || assignments.find((store) => store.primary || store.isPrimary) || assignments[0];
}

function normalizeStoreAssignments(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (Array.isArray(value.items)) return value.items.filter(Boolean);
  if (Array.isArray(value.stores)) return value.stores.filter(Boolean);
  return [value].filter(Boolean);
}

function hasHubAdminRole(roleKeys) {
  return roleKeys.some((roleKey) => HUB_ADMIN_ROLE_KEYS.has(roleKey));
}

function normalizeStringArray(value) {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list
    .map((item) => {
      if (typeof item === "string") return item;
      return item?.roleKey || item?.key || item?.name || item?.id || "";
    })
    .map((item) => String(item).trim())
    .filter(Boolean);
}

function firstString(...values) {
  const value = values.find((item) => typeof item === "string" && item.trim());
  return value ? value.trim() : "";
}

function createRuleId(value) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || `rule-${Date.now()}`;
}

function authenticateWithStoreMaster(storeId, storePass) {
  const payload = {
    action: "login",
    storeId: storeId.trim(),
    storePass
  };

  const request = STORE_MASTER_CONFIG.loginEndpoint
    ? requestJson(STORE_MASTER_CONFIG.loginEndpoint, payload)
    : Promise.resolve({ ok: false, error: "ログインAPIが設定されていません。" });

  return request.then((result) => {
    if (!result.ok) {
      throw new Error(result.error || "店舗IDまたは店舗PASSが違います。");
    }
    const store = result.store || result;
    return {
      id: store.loginId || store.id,
      storeId: store.storeId || store.id,
      name: store.name,
      admin: Boolean(store.admin),
      token: store.sessionToken || store.token,
      source: store.source || "store-master"
    };
  });
}

const CONCIERGE_CLIENT_ERRORS = Object.freeze({
  request: "CONCIERGE_CLIENT_REQUEST_REJECTED",
  http: "CONCIERGE_CLIENT_HTTP_REJECTED",
  mediaType: "CONCIERGE_CLIENT_MEDIA_TYPE_REJECTED",
  json: "CONCIERGE_CLIENT_JSON_REJECTED",
  envelope: "CONCIERGE_CLIENT_ENVELOPE_REJECTED"
});

function conciergeClientError(category) {
  return new Error(category);
}

function assertConciergeBodyByteLength(body) {
  const byteLength = new TextEncoder().encode(body).byteLength;
  if (byteLength < 1 || byteLength > 4096) {
    throw conciergeClientError(CONCIERGE_CLIENT_ERRORS.request);
  }
  return byteLength;
}

function serializeConciergePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw conciergeClientError(CONCIERGE_CLIENT_ERRORS.request);
  }
  let body;
  try {
    body = JSON.stringify(payload);
  } catch {
    throw conciergeClientError(CONCIERGE_CLIENT_ERRORS.request);
  }
  assertConciergeBodyByteLength(body);
  return body;
}

function hasJsonResponseMediaType(response) {
  const mediaType = String(response.headers.get("content-type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  return mediaType === "application/json";
}

function assertConciergeResponseEnvelope(result) {
  if (!result || typeof result !== "object" || Array.isArray(result) || typeof result.ok !== "boolean") {
    throw conciergeClientError(CONCIERGE_CLIENT_ERRORS.envelope);
  }
  return result;
}

async function requestJson(url, payload) {
  const body = serializeConciergePayload(payload);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body
  });

  if (!response.ok) throw conciergeClientError(CONCIERGE_CLIENT_ERRORS.http);
  if (!hasJsonResponseMediaType(response)) {
    throw conciergeClientError(CONCIERGE_CLIENT_ERRORS.mediaType);
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw conciergeClientError(CONCIERGE_CLIENT_ERRORS.json);
  }
  return assertConciergeResponseEnvelope(result);
}

function requestBackend(action, payload) {
  if (STORE_MASTER_CONFIG.apiEndpoint && SUPABASE_BACKEND_ACTIONS.has(action)) {
    const sessionPayload = session?.token ? { sessionToken: session.token } : {};
    return requestJson(STORE_MASTER_CONFIG.apiEndpoint, { action, ...sessionPayload, ...payload });
  }

  return Promise.resolve({ ok: false, error: "未対応の操作です。" });
}

function hasRemoteBackend() {
  return Boolean(STORE_MASTER_CONFIG.apiEndpoint);
}

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

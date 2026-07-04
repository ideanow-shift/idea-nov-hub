export const CATEGORY_ORDER = ["称賛", "全般", "管理", "Finance Module", "コンピテンシー", "経営", "人財", "勤怠・シフト", "教育"];

const appBase = { allowedTags: [], targetDepartment: [], targetPosition: [], isActive: true };

export const DEMO_APPS = [
  { ...appBase, appId: "nov-hub", appName: "NOV HUB", description: "社内アプリをまとめて探せるポータル", url: "#demo-hub", category: "全般", icon: "nov-hub", requiredLevel: 1, isFeatured: true, priority: 5 },
  { ...appBase, appId: "nov-navi", appName: "NOV Navi", description: "必要な情報、申請、アプリへ案内します", url: "./concierge/", category: "全般", icon: "nov-hub", requiredLevel: 1, isFeatured: true, priority: 6 },
  { ...appBase, appId: "attendance", appName: "勤怠管理", description: "出勤・退勤の打刻と勤務実績の確認", url: "#demo-attendance", category: "勤怠・シフト", icon: "attendance", requiredLevel: 1, isFeatured: true, priority: 10 },
  { ...appBase, appId: "shift", appName: "シフト作成", description: "勤務予定・希望休の確認", url: "https://ideanow-shift.github.io/shift/shift_demo.html", category: "勤怠・シフト", icon: "shift", requiredLevel: 1, isFeatured: true, priority: 20 },
  { ...appBase, appId: "education-web", appName: "教育部WEBアプリ", description: "教育動画・技術マニュアル・研修予定", url: "#demo-learning", category: "教育", icon: "education-web", requiredLevel: 1, isFeatured: true, priority: 30 },
  { ...appBase, appId: "sales-web", appName: "営業部WEBアプリ", description: "店舗実績と目標進捗を確認", url: "#demo-sales", category: "経営", icon: "sales-web", requiredLevel: 3, allowedTags: ["sales", "executive"], isFeatured: true, priority: 40 },
  { ...appBase, appId: "inventory", appName: "棚卸し", description: "棚卸しと在庫差異の確認", url: "#demo-inventory", category: "全般", icon: "inventory", requiredLevel: 1, isFeatured: false, priority: 45 },
  { ...appBase, appId: "instagram-auto-post", appName: "Instagram自動投稿", description: "投稿素材と配信状況を確認", url: "#demo-instagram", category: "全般", icon: "instagram-auto-post", requiredLevel: 1, isFeatured: false, priority: 48 },
  { ...appBase, appId: "one-on-one", appName: "1on1 MTG", description: "面談記録とフィードバックを確認", url: "#demo-1on1", category: "コンピテンシー", icon: "one-on-one", requiredLevel: 2, isFeatured: false, priority: 50 },
  { ...appBase, appId: "management-system", appName: "経営管理システム", description: "経営指標と管理レポートを確認", url: "#demo-management", category: "経営", icon: "management-system", requiredLevel: 4, allowedTags: ["executive"], isFeatured: false, priority: 60 },
  { ...appBase, appId: "expense_hub", appName: "経費精算管理システム", description: "経費明細登録・月次精算・経理確認・弥生会計CSV出力", url: "https://ideanow-shift.github.io/idea-nov-expense-hub/", category: "Finance Module", icon: "expense-hub", requiredLevel: 1, isFeatured: false, priority: 66 },
  { ...appBase, appId: "product-management", appName: "商品管理", description: "商品情報・在庫・発注状況を確認", url: "#demo-product", category: "全般", icon: "product-management", requiredLevel: 1, isFeatured: false, priority: 70 },
  { ...appBase, appId: "task-management", appName: "タスク管理", description: "本部タスクと進捗を確認", url: "#demo-task", category: "全般", icon: "task-management", requiredLevel: 1, allowedTags: ["hq"], isFeatured: false, priority: 80 },
  { ...appBase, appId: "idea-link", appName: "IDEA LINK", description: "サンクス投稿と理念行動共有のHUB連携準備", url: "./idea-link/", category: "称賛", icon: "idea-link", requiredLevel: 1, isFeatured: false, priority: 88 },
  { ...appBase, appId: "sales-education-db", appName: "営業部⇔教育部DB", description: "営業部と教育部の連携データを確認", url: "#demo-db", category: "経営", icon: "sales-education-db", requiredLevel: 3, allowedTags: ["sales", "executive"], isFeatured: false, priority: 100 },
  { ...appBase, appId: "campaign-management", appName: "キャンペーン管理", description: "販促キャンペーンの進捗を確認", url: "#demo-campaign", category: "全般", icon: "campaign-management", requiredLevel: 1, isFeatured: false, priority: 110 },
  { ...appBase, appId: "human-capital-investment", appName: "人財投資管理システム", description: "育成投資と人財指標を確認", url: "https://ideanow-shift.github.io/hr-investment-dashboard/", category: "人財", icon: "human-capital-investment", requiredLevel: 4, allowedTags: ["executive", "backoffice"], isFeatured: false, priority: 64 },
  { ...appBase, appId: "management-check", appName: "Management Platform", description: "環境整備と管理者成長の履歴を確認", url: "./management-platform/", category: "コンピテンシー", icon: "management-check", requiredLevel: 3, allowedTags: ["manager", "executive"], isFeatured: false, priority: 62 },
  { ...appBase, appId: "disabled-sample", appName: "非公開アプリ", description: "表示されない確認用アプリ", url: "#", category: "全般", icon: "default", requiredLevel: 1, isActive: false, isFeatured: false, priority: 999 }
];

const DEFAULT_ICON = "./assets/icons/default.svg";
const DEFAULT_COLOR = "#E8B4B8";
let iconRegistry = {
  defaultIcon: DEFAULT_ICON,
  defaultColor: DEFAULT_COLOR,
  byKey: new Map(),
  byCategory: new Map()
};

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[（）()［］\[\]・/_-]/g, "")
    .toLowerCase();
}

function isEmojiLike(value) {
  return /[\p{Extended_Pictographic}\u2600-\u27BF]/u.test(String(value || ""));
}

function normalizeEntry(entry, fallbackIcon = DEFAULT_ICON, fallbackColor = DEFAULT_COLOR) {
  if (typeof entry === "string") return { icon: entry, color: fallbackColor };
  return {
    icon: entry?.icon || fallbackIcon,
    color: entry?.color || fallbackColor
  };
}

export async function loadAppIconRegistry() {
  try {
    const response = await fetch("./apps.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`apps.json ${response.status}`);
    const data = await response.json();
    const byKey = new Map();
    const byCategory = new Map();
    const defaultIcon = data.defaultIcon || DEFAULT_ICON;
    const defaultColor = data.defaultColor || DEFAULT_COLOR;
    (data.apps || []).forEach((item) => {
      const visual = normalizeEntry(item, defaultIcon, defaultColor);
      [item.appId, item.appName, ...(item.aliases || [])].forEach((key) => {
        const normalized = normalizeKey(key);
        if (normalized) byKey.set(normalized, visual);
      });
    });
    Object.entries(data.categories || {}).forEach(([category, entry]) => {
      byCategory.set(normalizeKey(category), normalizeEntry(entry, defaultIcon, defaultColor));
    });
    iconRegistry = { defaultIcon, defaultColor, byKey, byCategory };
  } catch (error) {
    console.warn("apps.json could not be loaded", error);
  }
  return iconRegistry;
}

export function resolveAppVisual(app) {
  const appColor = app.color && !isEmojiLike(app.color) ? app.color : "";
  const candidates = [app.icon, app.appId, app.appName].filter((value) => value && !isEmojiLike(value));
  for (const candidate of candidates) {
    const text = String(candidate);
    if (text.endsWith(".svg") || text.startsWith("./assets/icons/")) {
      return { icon: text, color: appColor || iconRegistry.defaultColor || DEFAULT_COLOR };
    }
    const visual = iconRegistry.byKey.get(normalizeKey(text));
    if (visual) return { ...visual, color: appColor || visual.color };
  }
  const categoryVisual = iconRegistry.byCategory.get(normalizeKey(app.category));
  if (categoryVisual) return { ...categoryVisual, color: appColor || categoryVisual.color };
  return { icon: iconRegistry.defaultIcon || DEFAULT_ICON, color: appColor || iconRegistry.defaultColor || DEFAULT_COLOR };
}

export function resolveAppIcon(app) {
  return resolveAppVisual(app).icon;
}

function matchesList(value, allowedValues) {
  return !allowedValues?.length || allowedValues.includes(value);
}

export function canAccessApp(employee, app) {
  if (!employee || employee.status !== "active" || !app.isActive) return false;
  if (Number(employee.roleLevel) < Number(app.requiredLevel || 1)) return false;
  if (app.allowedTags?.length) {
    const employeeTags = new Set(employee.tags || []);
    if (!app.allowedTags.some((tag) => employeeTags.has(tag))) return false;
  }
  return matchesList(employee.department, app.targetDepartment)
    && matchesList(employee.position, app.targetPosition);
}

export function getVisibleApps(employee, apps) {
  return apps
    .filter((app) => canAccessApp(employee, app))
    .sort((a, b) => Number(a.priority || 999) - Number(b.priority || 999));
}

export const CATEGORY_ORDER = ["勤怠・シフト", "教育", "売上管理", "評価", "FC管理", "資料室", "AIツール", "総務申請"];

export const DEMO_APPS = [
  { appId: "attendance", appName: "勤怠管理", description: "出勤・退勤の打刻と勤務実績の確認", url: "#demo-attendance", category: "勤怠・シフト", icon: "attendance", requiredLevel: 1, allowedTags: [], targetDepartment: [], targetPosition: [], isActive: true, isFeatured: true, priority: 10 },
  { appId: "shift", appName: "シフト作成", description: "勤務予定・希望休の確認", url: "#demo-shift", category: "勤怠・シフト", icon: "shift", requiredLevel: 1, allowedTags: [], targetDepartment: [], targetPosition: [], isActive: true, isFeatured: true, priority: 20 },
  { appId: "education-web", appName: "教育部WEBアプリ", description: "教育動画・技術マニュアル・研修予定", url: "#demo-learning", category: "教育", icon: "education-web", requiredLevel: 1, allowedTags: [], targetDepartment: [], targetPosition: [], isActive: true, isFeatured: true, priority: 30 },
  { appId: "sales-web", appName: "営業部WEBアプリ", description: "店舗実績と目標進捗を確認", url: "#demo-sales", category: "売上管理", icon: "sales-web", requiredLevel: 3, allowedTags: ["sales", "executive"], targetDepartment: [], targetPosition: [], isActive: true, isFeatured: true, priority: 40 },
  { appId: "one-on-one", appName: "1on1 MTG", description: "面談記録とフィードバックを確認", url: "#demo-1on1", category: "評価", icon: "one-on-one", requiredLevel: 2, allowedTags: [], targetDepartment: [], targetPosition: [], isActive: true, isFeatured: false, priority: 50 },
  { appId: "management-system", appName: "経営管理システム", description: "経営指標と管理レポートを確認", url: "#demo-management", category: "売上管理", icon: "management-system", requiredLevel: 4, allowedTags: ["executive"], targetDepartment: [], targetPosition: [], isActive: true, isFeatured: false, priority: 60 },
  { appId: "product-management", appName: "商品管理", description: "商品情報・在庫・発注状況を確認", url: "#demo-product", category: "資料室", icon: "product-management", requiredLevel: 1, allowedTags: [], targetDepartment: [], targetPosition: [], isActive: true, isFeatured: false, priority: 70 },
  { appId: "task-management", appName: "タスク管理", description: "本部タスクと進捗を確認", url: "#demo-task", category: "総務申請", icon: "task-management", requiredLevel: 1, allowedTags: ["hq"], targetDepartment: [], targetPosition: [], isActive: true, isFeatured: false, priority: 80 },
  { appId: "disabled-sample", appName: "非公開アプリ", description: "表示されない確認用アプリ", url: "#", category: "資料室", icon: "default", requiredLevel: 1, allowedTags: [], targetDepartment: [], targetPosition: [], isActive: false, isFeatured: false, priority: 999 }
];

const DEFAULT_ICON = "./assets/icons/default.svg";
let iconRegistry = { defaultIcon: DEFAULT_ICON, byKey: new Map(), byCategory: new Map() };

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

export async function loadAppIconRegistry() {
  try {
    const response = await fetch("./apps.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`apps.json ${response.status}`);
    const data = await response.json();
    const byKey = new Map();
    const byCategory = new Map();
    (data.apps || []).forEach((item) => {
      const icon = item.icon || data.defaultIcon || DEFAULT_ICON;
      [item.appId, item.appName, ...(item.aliases || [])].forEach((key) => {
        const normalized = normalizeKey(key);
        if (normalized) byKey.set(normalized, icon);
      });
    });
    Object.entries(data.categories || {}).forEach(([category, icon]) => {
      byCategory.set(normalizeKey(category), icon);
    });
    iconRegistry = { defaultIcon: data.defaultIcon || DEFAULT_ICON, byKey, byCategory };
  } catch (error) {
    console.warn("apps.json could not be loaded", error);
  }
  return iconRegistry;
}

export function resolveAppIcon(app) {
  const candidates = [app.icon, app.appId, app.appName].filter((value) => value && !isEmojiLike(value));
  for (const candidate of candidates) {
    const text = String(candidate);
    if (text.endsWith(".svg") || text.startsWith("./assets/icons/")) return text;
    const icon = iconRegistry.byKey.get(normalizeKey(text));
    if (icon) return icon;
  }
  return iconRegistry.byCategory.get(normalizeKey(app.category)) || iconRegistry.defaultIcon || DEFAULT_ICON;
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

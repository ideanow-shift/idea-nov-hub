export const CATEGORY_ORDER = ["勤怠・シフト", "教育", "売上管理", "評価", "FC管理", "資料室", "AIツール", "総務申請"];

export const CATEGORY_ICONS = {
  "勤怠・シフト": "📅",
  "教育": "🎓",
  "売上管理": "📊",
  "評価": "📝",
  "FC管理": "🏢",
  "資料室": "📁",
  "AIツール": "🤖",
  "総務申請": "⚙️"
};

export const DEMO_APPS = [
  { appId: "attendance", appName: "勤怠打刻", description: "出勤・退勤の打刻と勤務実績の確認", url: "#demo-attendance", category: "勤怠・シフト", icon: "⏱️", requiredLevel: 1, allowedTags: [], targetDepartment: [], targetPosition: [], isActive: true, isFeatured: true, priority: 10 },
  { appId: "shift", appName: "シフト管理", description: "勤務予定・希望休の確認", url: "#demo-shift", category: "勤怠・シフト", icon: "📅", requiredLevel: 1, allowedTags: [], targetDepartment: [], targetPosition: [], isActive: true, isFeatured: true, priority: 20 },
  { appId: "learning", appName: "NOV Academy", description: "教育動画・技術マニュアル・研修予定", url: "#demo-learning", category: "教育", icon: "🎓", requiredLevel: 1, allowedTags: [], targetDepartment: [], targetPosition: [], isActive: true, isFeatured: true, priority: 30 },
  { appId: "sales-dashboard", appName: "売上ダッシュボード", description: "店舗実績と目標進捗を確認", url: "#demo-sales", category: "売上管理", icon: "📊", requiredLevel: 3, allowedTags: ["sales", "executive"], targetDepartment: [], targetPosition: [], isActive: true, isFeatured: true, priority: 40 },
  { appId: "evaluation", appName: "人事評価", description: "評価入力と面談記録の確認", url: "#demo-evaluation", category: "評価", icon: "📝", requiredLevel: 2, allowedTags: [], targetDepartment: [], targetPosition: [], isActive: true, isFeatured: false, priority: 50 },
  { appId: "fc-report", appName: "FC運営レポート", description: "FC店舗の運営状況と報告書", url: "#demo-fc", category: "FC管理", icon: "🏢", requiredLevel: 4, allowedTags: ["fc"], targetDepartment: [], targetPosition: [], isActive: true, isFeatured: false, priority: 60 },
  { appId: "documents", appName: "社内資料室", description: "規程・申請書・ブランド資料を検索", url: "#demo-documents", category: "資料室", icon: "📁", requiredLevel: 1, allowedTags: [], targetDepartment: [], targetPosition: [], isActive: true, isFeatured: false, priority: 70 },
  { appId: "ai-assistant", appName: "NOV AIアシスタント", description: "文章作成や業務の相談をサポート", url: "#demo-ai", category: "AIツール", icon: "🤖", requiredLevel: 1, allowedTags: [], targetDepartment: [], targetPosition: [], isActive: true, isFeatured: false, priority: 80 },
  { appId: "hq-request", appName: "本部申請", description: "購買・稟議・各種申請をまとめて提出", url: "#demo-hq", category: "総務申請", icon: "⚙️", requiredLevel: 1, allowedTags: ["hq"], targetDepartment: ["経営企画部", "総務部"], targetPosition: [], isActive: true, isFeatured: false, priority: 90 },
  { appId: "disabled-sample", appName: "非公開アプリ", description: "表示されない確認用アプリ", url: "#", category: "資料室", icon: "🔒", requiredLevel: 1, allowedTags: [], targetDepartment: [], targetPosition: [], isActive: false, isFeatured: false, priority: 999 }
];

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

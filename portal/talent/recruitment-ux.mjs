const DASHBOARD_METRICS = Object.freeze([
  ["candidateCount", "学生"],
  ["graduation2027", "27卒"],
  ["graduation2028", "28卒"],
  ["lineRegistrations", "LINE登録"],
  ["entries", "応募"],
  ["salonTourPlanned", "見学予定"],
  ["salonTourCompleted", "見学済み"],
  ["interviewPlanned", "面接予定"],
  ["interviewHistory", "面接履歴"],
  ["offers", "内定"],
  ["offeredElsewhere", "他社内定"],
  ["withdrawals", "辞退"],
  ["rejected", "不採用"],
  ["schoolCount", "学校"],
  ["fairCount", "フェア"],
  ["eventCount", "Event / Contact"]
]);

export function japanBusinessDateIso(instant = new Date()) {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) return japanBusinessDateIso(new Date());
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function classifyRecruitmentTaskPriority(task, referenceDate = japanBusinessDateIso()) {
  const dueDate = String(task?.dueDate || "");
  const today = /^\d{4}-\d{2}-\d{2}$/u.test(String(referenceDate || "")) ? String(referenceDate) : japanBusinessDateIso();
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(dueDate)) return "UNSCHEDULED";
  if (dueDate < today) return "OVERDUE";
  if (dueDate === today) return "DUE_TODAY";
  return "SCHEDULED";
}

export function buildRecruitmentDashboardDecision(workspace, tasks = [], referenceDate = japanBusinessDateIso()) {
  const students = Array.isArray(workspace?.students) ? workspace.students : [];
  const dashboard = workspace?.dashboard || {};
  const availability = dashboard?.availability || {};
  const metrics = DASHBOARD_METRICS.map(([key, label]) => Object.freeze({
    key, label, value: availability[key] === true && Number.isInteger(dashboard[key])
      ? dashboard[key] : "集計準備中"
  }));
  const overdueCount = (Array.isArray(tasks) ? tasks : [])
    .filter((task) => classifyRecruitmentTaskPriority(task, referenceDate) === "OVERDUE").length;
  const reviewCount = students.filter((student) => ["OWNER_REVIEW", "QUARANTINE"].includes(student?.classification)).length;
  const offerCount = availability.offers === true ? Number(dashboard.offers || 0) : 0;
  let category = "STEADY_FOLLOW_UP";
  let title = "採用状況は安定しています。予定されたフォローから進めてください";
  let copy = "期限の近い学生を確認し、次回アクションを更新します。";
  if (overdueCount > 0) {
    category = "OVERDUE_FIRST";
    // todayTasks is a capped display list, not a complete count contract.
    title = "期限超過の対応があります";
    copy = "今日やることの先頭から対応し、次回アクションを必ず残してください。";
  } else if (reviewCount > 0) {
    category = "REVIEW_FIRST";
    title = `対応内容の確認が${reviewCount}件あります`;
    copy = "学生一覧から対象を開き、必要な情報を更新してください。";
  } else if (Object.values(availability).some((value) => value !== true)) {
    category = "AGGREGATION_PREPARING";
    title = "一部指標は入力準備中です";
    copy = "接続済みの学生・履歴は実数で表示しています。未入力の予定日は日常運用で補完してください。";
  } else if (offerCount > 0) {
    category = "OFFER_FOLLOW_UP";
    title = `内定中の学生が${offerCount}件います`;
    copy = "承諾確認と入社予定日の記録を優先してください。";
  } else if (students.length === 0) {
    category = "EMPTY";
    title = "学生データはまだありません";
    copy = "管理者へデータの利用状況を確認してください。";
  }
  return Object.freeze({ category, title, copy, metrics: Object.freeze(metrics), rawValuesIncluded: false });
}

export function buildRecruitmentTaskBoard(tasks, referenceDate = japanBusinessDateIso()) {
  return Object.freeze((Array.isArray(tasks) ? tasks : []).slice(0, 5).map((task, index) => Object.freeze({
    ...task,
    order: index + 1,
    priorityCategory: classifyRecruitmentTaskPriority(task, referenceDate),
    source: task.source || "STAGING_NEXT_ACTION"
  })));
}

export function buildEventRoiView(workspace) {
  void workspace;
  // Workspace v1 has no CONFIRMED ORIGIN Candidate-Fair relation. Global
  // Event/Selection totals must never be divided and presented as Fair ROI.
  return Object.freeze({
    category: "FAIR_ATTRIBUTION_PREPARING",
    title: "フェア起点確認後に集計します",
    copy: "学生とフェアのきっかけが確認されるまで、応募・内定の到達率は表示しません。",
    metrics: Object.freeze([
      Object.freeze({ key: "entryRate", label: "応募到達率", value: "集計準備中" }),
      Object.freeze({ key: "offerRate", label: "内定到達率", value: "集計準備中" }),
      Object.freeze({ key: "acceptedRate", label: "承諾到達率", value: "集計準備中" })
    ]),
    costAvailable: false, estimated: false
  });
}

export function buildCandidateHistorySummary(student) {
  const count = (rows) => Array.isArray(rows) ? rows.length : 0;
  return Object.freeze({
    contactCount: count(student?.contactHistory), eventCount: count(student?.eventHistory),
    selectionCount: count(student?.selectionHistory),
    total: count(student?.contactHistory) + count(student?.eventHistory) + count(student?.selectionHistory)
  });
}

const RUNTIME_PRESENTATIONS = Object.freeze({
  loading: ["loading", "学生データを準備しています", "そのままお待ちください。"],
  ready: ["ready", "採用画面を利用できます", "学生データを読み込みました。"],
  empty: ["empty", "学生データはまだありません", "管理者へデータの利用状況を確認してください。"],
  auth_required: ["stopped", "ログイン状態を確認してください", "上部の「NOV HUBへ戻る」からログインし直してください。"],
  unauthorized: ["stopped", "利用者を確認できません", "NOV HUBへ戻ってログイン状態を確認してください。"],
  forbidden: ["stopped", "この画面を利用できません", "管理者へ利用範囲を確認してください。"],
  api_error: ["stopped", "学生データを取得できません", "接続状態を確認してから再読み込みしてください。"],
  invalid_response: ["stopped", "学生データを確認できません", "管理者へデータ取得状況を確認してください。"],
  validation_error: ["stopped", "学生データを確認できません", "データ形式を確認してから再読み込みしてください。"],
  timeout: ["stopped", "読み込みに時間がかかっています", "再読み込みを1回お試しください。"],
  offline: ["stopped", "オフライン状態です", "接続を確認してから再読み込みしてください。"],
  maintenance: ["stopped", "現在メンテナンス中です", "利用再開までお待ちください。"]
});

export function buildMockRuntimePresentation(state) {
  const key = Object.hasOwn(RUNTIME_PRESENTATIONS, state) ? state : "api_error";
  const [viewState, title, copy] = RUNTIME_PRESENTATIONS[key];
  return Object.freeze({ category: key.toUpperCase(), state: viewState, title, copy });
}

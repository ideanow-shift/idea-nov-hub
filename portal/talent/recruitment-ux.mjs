const FUNNEL_METRICS = Object.freeze([
  ["entries", "エントリー", "CONTACT"],
  ["salonTours", "見学", "SALON_TOUR"],
  ["interviews", "面接", "INTERVIEW"],
  ["offers", "内定", "OFFER"],
  ["accepted", "承諾", "PASSED"],
  ["expectedJoiners", "入社予定", "EXPECTED_JOIN"]
]);

export function buildRecruitmentDashboardDecision(workspace, tasks = []) {
  const students = Array.isArray(workspace?.students) ? workspace.students : [];
  const metrics = FUNNEL_METRICS.map(([key, label, statusCode]) => Object.freeze({
    key, label, value: students.filter((student) => student?.statusCode === statusCode).length
  }));
  const overdueCount = (Array.isArray(tasks) ? tasks : []).filter((task) => task?.priority === "高").length;
  const reviewCount = students.filter((student) => ["OWNER_REVIEW", "QUARANTINE"].includes(student?.classification)).length;
  const offerCount = metrics.find((metric) => metric.key === "offers")?.value || 0;
  let category = "STEADY_FOLLOW_UP";
  let title = "採用状況は安定しています。予定されたフォローから進めてください";
  let copy = "期限の近い候補者を確認し、次回アクションを更新します。";
  if (overdueCount > 0) {
    category = "OVERDUE_FIRST";
    title = `期限超過の対応が${overdueCount}件あります`;
    copy = "今日やることの先頭から対応し、次回アクションを必ず残してください。";
  } else if (reviewCount > 0) {
    category = "REVIEW_FIRST";
    title = `要確認・隔離が${reviewCount}件あります`;
    copy = "候補者一覧で確認区分を絞り込み、判断できる行から整理してください。";
  } else if (offerCount > 0) {
    category = "OFFER_FOLLOW_UP";
    title = `内定中の候補者が${offerCount}件います`;
    copy = "承諾確認と入社予定日の記録を優先してください。";
  } else if (students.length === 0) {
    category = "EMPTY";
    title = "候補者データはまだありません";
    copy = "Mockデータの状態を確認してから採用活動を開始してください。";
  }
  return Object.freeze({ category, title, copy, metrics: Object.freeze(metrics), rawValuesIncluded: false });
}

export function buildRecruitmentTaskBoard(tasks) {
  return Object.freeze((Array.isArray(tasks) ? tasks : []).slice(0, 5).map((task, index) => Object.freeze({
    ...task, order: index + 1, source: "EXISTING_MOCK_DATA"
  })));
}

export function buildEventRoiView(workspace) {
  const students = Array.isArray(workspace?.students) ? workspace.students : [];
  const count = (code) => students.filter((student) => student?.statusCode === code).length;
  const contacts = students.length;
  const rate = (value) => contacts ? Math.round((value / contacts) * 100) : 0;
  return Object.freeze({
    category: "ROI_UNAVAILABLE_COST_MISSING",
    title: "費用未登録のため、金額ROIは算出していません",
    copy: "既存データから確認できる接点後の進捗率を表示します。費用や成果は推測しません。",
    metrics: Object.freeze([
      Object.freeze({ key: "entryRate", label: "エントリー到達率", value: `${rate(count("CONTACT"))}%` }),
      Object.freeze({ key: "offerRate", label: "内定到達率", value: `${rate(count("OFFER"))}%` }),
      Object.freeze({ key: "acceptedRate", label: "承諾到達率", value: `${rate(count("PASSED"))}%` })
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
  loading: ["loading", "候補者データを準備しています", "そのままお待ちください。"],
  ready: ["ready", "採用画面を利用できます", "候補者データを読み込みました。"],
  empty: ["empty", "候補者データはまだありません", "接続先と対象Datasetを確認してください。"],
  auth_required: ["stopped", "ログイン状態を確認してください", "上部の「NOV HUBへ戻る」からログインし直してください。"],
  unauthorized: ["stopped", "利用者を確認できません", "NOV HUBへ戻ってログイン状態を確認してください。"],
  forbidden: ["stopped", "この画面を利用できません", "管理者へ利用範囲を確認してください。"],
  api_error: ["stopped", "Staging候補者を取得できません", "接続状態を確認してから再読み込みしてください。"],
  invalid_response: ["stopped", "候補者データを確認できません", "管理者へデータ取得状況を確認してください。"],
  validation_error: ["stopped", "候補者データを確認できません", "データ形式を確認してから再読み込みしてください。"],
  timeout: ["stopped", "読み込みに時間がかかっています", "再読み込みを1回お試しください。"],
  offline: ["stopped", "オフライン状態です", "接続を確認してから再読み込みしてください。"],
  maintenance: ["stopped", "現在メンテナンス中です", "利用再開までお待ちください。"]
});

export function buildMockRuntimePresentation(state) {
  const key = Object.hasOwn(RUNTIME_PRESENTATIONS, state) ? state : "api_error";
  const [viewState, title, copy] = RUNTIME_PRESENTATIONS[key];
  return Object.freeze({ category: key.toUpperCase(), state: viewState, title, copy });
}

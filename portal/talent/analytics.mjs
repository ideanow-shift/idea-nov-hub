const SUMMARY_METRICS = Object.freeze([
  ["total", "取込データ"],
  ["contacts", "接触"],
  ["lineRegistrations", "LINE登録"],
  ["entries", "エントリー"],
  ["offers", "内定"],
  ["mapped", "紐付け済み"],
  ["needsAction", "要確認・隔離"]
]);

export function buildTalentAnalytics(workspace) {
  const students = Array.isArray(workspace?.students) ? workspace.students : [];
  const overview = workspace?.overview || {};
  const availability = workspace?.dashboard?.availability || {};
  const unavailableViews = new Set(workspace?.partialStatus?.unavailableViews || []);
  const lineRegistrations = Number.isInteger(workspace?.dashboard?.lineRegistrations)
    && workspace.dashboard.lineRegistrations >= 0 ? workspace.dashboard.lineRegistrations : null;
  const fairSourceAvailable = Array.isArray(workspace?.fairMasters)
    && workspace?.dashboard?.availability?.fairCount !== false;
  const fairMasters = fairSourceAvailable ? workspace.fairMasters.filter((row) => row.is_active !== false) : [];
  const schoolSourceAvailable = Array.isArray(workspace?.schoolMasters)
    && workspace?.dashboard?.availability?.schoolCount !== false;
  const schoolMasters = schoolSourceAvailable ? workspace.schoolMasters.filter((row) => row.is_active !== false) : [];
  const activeSchoolIds = new Set(schoolMasters.map((row) => row?.school_id).filter(Boolean));
  const flow = fairSourceAvailable ? buildFairMasterFlow(fairMasters) : [];
  const availableMetric = (availabilityKey, value) => availability[availabilityKey] === false || value == null
    ? null : safeCount(value);
  const summaryValues = {
    total: safeCount(overview.total),
    contacts: availableMetric("eventCount", overview.contacts),
    lineRegistrations: availableMetric("lineRegistrations", lineRegistrations),
    entries: availableMetric("entries", overview.entries),
    offers: availableMetric("offers", overview.offers),
    mapped: safeCount(overview.mapped),
    needsAction: unavailableViews.has("source_facts")
      ? null : safeCount(overview.ownerReview) + safeCount(overview.quarantined)
  };

  return Object.freeze({
    summary: Object.freeze(SUMMARY_METRICS.map(([key, label]) => Object.freeze({
      key,
      label,
      value: summaryValues[key] === null ? "集計準備中" : summaryValues[key]
    }))),
    flow: Object.freeze(flow),
    schools: Object.freeze(schoolSourceAvailable
      ? buildSchoolMasterRows(schoolMasters, students, workspace?.dashboard?.availability)
      : []),
    fairSourceAvailable,
    schoolSourceAvailable,
    coverage: Object.freeze({
      // contacts is an Event row count while lineRegistrations is a unique
      // Candidate count. Their grains differ, so no overall rate is published.
      lineRegistrationRate: null,
      schoolRegistered: schoolSourceAvailable ? schoolMasters.length : null,
      // Formal School coverage is the Candidate -> School Master relation. A display
      // name without school_id remains unlinked and must not be promoted to a match.
      schoolMissing: schoolSourceAvailable
        ? countBy(students, (student) => !student?.schoolId || !activeSchoolIds.has(student.schoolId))
        : null,
      monthCount: new Set(flow.map((row) => row.key).filter(Boolean)).size
    })
  });
}

function buildFairMasterFlow(masters) {
  return masters.slice().sort((left, right) => (
    cleanText(right?.event_date).localeCompare(cleanText(left?.event_date))
    || cleanText(left?.fair_name).localeCompare(cleanText(right?.fair_name), "ja")
  )).map((fair) => {
    const month = normalizeFairEventMonth(fair.event_date);
    const contacts = nullableCount(fair.contact_count);
    const lineRegistrations = nullableCount(fair.line_registration_count);
    const participationFee = nullableAmount(fair.participation_fee);
    return Object.freeze({
      key: month,
      label: String(fair.fair_name || "フェア"),
      contacts,
      lineRegistrations,
      entries: null,
      offers: null,
      needsAction: null,
      hires: null,
      participationFee,
      hireRate: null,
      hireCost: null,
      legacyKpiStatus: "PREPARING",
      // Fair Master has no CONFIRMED ORIGIN Candidate attribution in Workspace v1.
      // The month is valid for Fair reporting, but must not be used as a Candidate filter.
      candidateLinkReady: false
    });
  });
}

function buildSchoolMasterRows(masters, students, availability) {
  return masters.map((master) => {
    const linked = students.filter((student) => student.schoolId === master.school_id);
    return buildSchoolFactRow(master.school_id, master.school_name, linked, availability);
  }).sort((left, right) => sortMetric(right.contacts) - sortMetric(left.contacts) || left.school.localeCompare(right.school, "ja"));
}

export function normalizeFairEventMonth(value) {
  const normalized = cleanText(value);
  return /^\d{4}-\d{2}(?:-\d{2})?$/u.test(normalized) ? normalized.slice(0, 7) : "";
}

export function buildTalentAnalyticsActionGuide(analytics) {
  const summary = Array.isArray(analytics?.summary) ? analytics.summary : [];
  const flow = Array.isArray(analytics?.flow) ? analytics.flow : [];
  const schools = Array.isArray(analytics?.schools) ? analytics.schools : [];
  const coverage = analytics?.coverage || {};
  const needsActionValue = summary.find((item) => item.key === "needsAction")?.value;
  const needsActionReady = Number.isInteger(needsActionValue) && needsActionValue >= 0;
  const needsAction = needsActionReady ? needsActionValue : 0;
  const total = safeCount(summary.find((item) => item.key === "total")?.value);
  const lineRate = Number.isFinite(coverage.lineRegistrationRate) ? coverage.lineRegistrationRate : null;
  const schoolMissing = safeCount(coverage.schoolMissing);
  const topSchool = schools.find((row) => Number.isInteger(row?.contacts) && row.contacts > 0);
  const latestMonth = flow[0];
  const latestMonthCandidateLinkReady = Boolean(latestMonth?.key && latestMonth?.candidateLinkReady === true);

  const category = !needsActionReady
    ? "ANALYTICS_PREPARING"
    : needsAction > 0
      ? "OWNER_REVIEW_FIRST"
      : latestMonthCandidateLinkReady
      ? "LATEST_MONTH_FOLLOW_UP"
      : topSchool?.school
        ? "SCHOOL_FOLLOW_UP"
        : total > 0
          ? "STUDENT_LIST_REVIEW"
          : "NO_ANALYTICS_ACTION";

  const copyByCategory = {
    ANALYTICS_PREPARING: [
      "一部の確認指標は集計準備中です",
      "要確認データの取得が完了するまで、この集計から対応対象を判断しません。"
    ],
    OWNER_REVIEW_FIRST: [
      "要確認・隔離を先に整理",
      "分析を見る前に、確定・隔離維持・個別確認を分けると次の投入判断が楽になります。"
    ],
    LATEST_MONTH_FOLLOW_UP: [
      "最新月の学生フォローへ進む",
      "直近の接触月を開き、次回対応日と状態を整えるのが一番早い進め方です。"
    ],
    SCHOOL_FOLLOW_UP: [
      "接触数の多い学校から確認",
      "学校別の偏りを見ながら、対象学生のフォロー一覧へ直接移動できます。"
    ],
    STUDENT_LIST_REVIEW: [
      "学生一覧で日常更新を進める",
      "状態・次回対応・担当を整え、分析に戻って件数の変化を確認します。"
    ],
    NO_ANALYTICS_ACTION: [
      "まだ分析対象がありません",
      "27卒stagingまたは28卒CSV preflightの取り込み後に、分析からフォローへ進めます。"
    ]
  };
  const stepsByCategory = {
    ANALYTICS_PREPARING: [
      ["WAIT_FOR_FACTS", "要確認データの取得完了を待つ"],
      ["KEEP_PARTIAL_VISIBLE", "接続済みの指標だけを確認する"],
      ["NO_FALSE_ZERO", "未取得を0件として判断しない"]
    ],
    OWNER_REVIEW_FIRST: [
      ["OPEN_REVIEW_QUEUE", "要確認・隔離の学生一覧を開く"],
      ["SEPARATE_DECISIONS", "一括承認・個別確認・隔離維持を混ぜずに判断"],
      ["KEEP_PROMOTION_BLOCKED", "canonical・LINE履歴への昇格は別承認まで停止"]
    ],
    LATEST_MONTH_FOLLOW_UP: [
      ["OPEN_LATEST_MONTH", "最新月のフォロー一覧を開く"],
      ["SET_NEXT_ACTION", "次回対応日・状態・担当を更新"],
      ["RETURN_TO_ANALYTICS", "フェア分析でLINE登録率と内定導線を確認"]
    ],
    SCHOOL_FOLLOW_UP: [
      ["OPEN_TOP_SCHOOL", "接触数の多い学校の学生一覧を開く"],
      ["CHECK_UNMAPPED", "未紐付け・要確認だけを先に整理"],
      ["COMPARE_RATES", "学校別のエントリー率・内定率を見直す"]
    ],
    STUDENT_LIST_REVIEW: [
      ["OPEN_STUDENT_LIST", "学生フォロー一覧を開く"],
      ["SORT_BY_FOLLOW_UP", "対応期限順で期限超過から処理"],
      ["UPDATE_DAILY_FIELDS", "状態・次回対応・担当を迷わず更新"]
    ],
    NO_ANALYTICS_ACTION: [
      ["WAIT_FOR_STAGING", "stagingまたはCSV preflight後に再集計"],
      ["KEEP_EMPTY_STATE", "空状態では書込み操作を表示しない"],
      ["NO_RAW_VALUES", "個人値やrawデータを分析カードに出さない"]
    ]
  };

  return Object.freeze({
    category,
    title: copyByCategory[category][0],
    copy: copyByCategory[category][1],
    needsActionCategory: !needsActionReady ? "PREPARING" : needsAction > 0 ? "MULTIPLE" : "ZERO",
    latestMonthAvailable: latestMonthCandidateLinkReady,
    topSchoolAvailable: Boolean(topSchool?.school),
    lineRegistrationRateCategory: lineRate === null ? "PREPARING" : lineRate >= 70 ? "HIGH" : lineRate >= 40 ? "MEDIUM" : lineRate > 0 ? "LOW" : "ZERO",
    schoolMissingCategory: schoolMissing > 0 ? "MULTIPLE" : "ZERO",
    rawValuesIncluded: false,
    canonicalWriteReachable: false,
    lineHistoryWriteReachable: false,
    productionWriteReachable: false,
    steps: Object.freeze((stepsByCategory[category] || stepsByCategory.NO_ANALYTICS_ACTION).map(([stepCategory, label], index) => Object.freeze({
      order: index + 1,
      category: stepCategory,
      label
    })))
  });
}

export function buildTalentAnalyticsQueueHandoff(guide) {
  const category = typeof guide?.category === "string" ? guide.category : "NO_ANALYTICS_ACTION";
  const routes = {
    ANALYTICS_PREPARING: {
      category: "NO_QUEUE_HANDOFF",
      queueFilterCategory: "NONE",
      sortCategory: "NONE",
      steps: ["WAIT_FOR_FACTS", "KEEP_PARTIAL_VISIBLE", "NO_FALSE_ZERO"]
    },
    OWNER_REVIEW_FIRST: {
      category: "OPEN_STUDENT_REVIEW_QUEUE",
      queueFilterCategory: "OWNER_REVIEW_OR_QUARANTINE",
      sortCategory: "REVIEW_PRIORITY",
      steps: ["OPEN_REVIEW_QUEUE", "SEPARATE_DECISIONS", "KEEP_PROMOTION_BLOCKED"]
    },
    LATEST_MONTH_FOLLOW_UP: {
      category: "OPEN_LATEST_MONTH_QUEUE",
      queueFilterCategory: "LATEST_MONTH",
      sortCategory: "FOLLOW_UP_DUE",
      steps: ["OPEN_LATEST_MONTH", "SET_NEXT_ACTION", "RETURN_TO_ANALYTICS"]
    },
    SCHOOL_FOLLOW_UP: {
      category: "OPEN_TOP_SCHOOL_QUEUE",
      queueFilterCategory: "TOP_SCHOOL",
      sortCategory: "CONTACT_VOLUME",
      steps: ["OPEN_TOP_SCHOOL", "CHECK_UNMAPPED", "COMPARE_RATES"]
    },
    STUDENT_LIST_REVIEW: {
      category: "OPEN_STUDENT_LIST_QUEUE",
      queueFilterCategory: "ALL_STUDENTS",
      sortCategory: "FOLLOW_UP_DUE",
      steps: ["OPEN_STUDENT_LIST", "SORT_BY_FOLLOW_UP", "UPDATE_DAILY_FIELDS"]
    },
    NO_ANALYTICS_ACTION: {
      category: "NO_QUEUE_HANDOFF",
      queueFilterCategory: "NONE",
      sortCategory: "NONE",
      steps: ["WAIT_FOR_STAGING", "KEEP_EMPTY_STATE", "NO_RAW_VALUES"]
    }
  };
  const route = routes[category] || routes.NO_ANALYTICS_ACTION;
  return Object.freeze({
    category: route.category,
    sourceGuideCategory: category,
    queueFilterCategory: route.queueFilterCategory,
    sortCategory: route.sortCategory,
    rawValuesIncluded: false,
    productionWriteReachable: false,
    canonicalWriteReachable: false,
    lineHistoryWriteReachable: false,
    promotionReachable: false,
    steps: Object.freeze(route.steps.map((stepCategory, index) => Object.freeze({
      order: index + 1,
      category: stepCategory
    })))
  });
}

function buildSchoolRows(students, availability) {
  const groups = new Map();
  students.forEach((student) => {
    const school = cleanText(student.school);
    if (!school) return;
    const key = normalizeGroupKey(school);
    const group = groups.get(key) || { key, school, students: [] };
    group.students.push(student);
    groups.set(key, group);
  });
  return [...groups.values()]
    .map((group) => buildSchoolFactRow(group.key, group.school, group.students, availability))
    .sort((left, right) => (
      sortMetric(right.contacts) - sortMetric(left.contacts)
      || sortMetric(right.entries) - sortMetric(left.entries)
      || left.school.localeCompare(right.school, "ja")
    ));
}

export function buildSchoolFactRow(key, school, students, availability = {}) {
  const linked = Array.isArray(students) ? students : [];
  const hasEvent = (student, code) => [...(student?.contactHistory || []), ...(student?.eventHistory || [])]
    .some((item) => item?.active !== false && item?.code === code);
  const hasSelection = (student, code) => (student?.selectionHistory || [])
    .some((item) => item?.active !== false && item?.code === code);
  const contacts = availability?.eventCount === true
    ? linked.reduce((count, student) => count + [...(student?.contactHistory || []), ...(student?.eventHistory || [])]
      .filter((item) => item?.active !== false && item?.code === "CONTACT_RECORDED").length, 0)
    : null;
  const lineRegistrations = availability?.lineRegistrations === true
    ? linked.filter((student) => hasEvent(student, "LINE_REGISTERED")).length : null;
  const salonTours = availability?.salonTourCompleted === true
    ? linked.filter((student) => hasEvent(student, "SALON_TOUR_COMPLETED")).length : null;
  const entries = availability?.entries === true
    ? linked.filter((student) => hasSelection(student, "APPLICATION_RECEIVED")).length : null;
  const interviews = availability?.interviewHistory === true
    ? linked.filter((student) => hasSelection(student, "INTERVIEW_COMPLETED")).length : null;
  const offers = availability?.offers === true
    ? linked.filter((student) => hasSelection(student, "OFFERED")).length : null;
  const hires = null;
  const needsAction = linked.filter((student) => ["OWNER_REVIEW", "QUARANTINE"].includes(student?.classification)).length;
  return Object.freeze({
    key,
    school,
    contacts,
    lineRegistrations,
    salonTours,
    entries,
    interviews,
    offers,
    hires,
    needsAction,
    // contacts counts Event rows; Selection metrics count unique Candidates.
    // Do not divide mixed grains until a same-grain contract is connected.
    entryRate: null,
    offerRate: null,
    hireRate: null
  });
}

function sortMetric(value) {
  return Number.isFinite(value) ? value : -1;
}

function cleanText(value) {
  return String(value || "").normalize("NFKC").trim();
}

function normalizeGroupKey(value) {
  return cleanText(value)
    .replace(/\s+/gu, "")
    .toLocaleLowerCase("ja-JP");
}

function countBy(values, predicate) {
  return values.reduce((count, value) => count + (predicate(value) ? 1 : 0), 0);
}

function percentage(numerator, denominator) {
  if (!Number.isFinite(denominator) || denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function safeCount(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function nullableCount(value) {
  return value == null ? null : safeCount(value);
}

function nullableAmount(value) {
  if (value === null) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

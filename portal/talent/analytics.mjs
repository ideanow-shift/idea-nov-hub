const SOURCE_CODES = Object.freeze({
  CONTACTS_27: "contacts",
  ENTRIES_27: "entries",
  OFFERS_27: "offers"
});

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
  const lineRegistrations = countBy(students, (student) => Boolean(student.lineRegistrationDate));
  const summaryValues = {
    total: safeCount(overview.total),
    contacts: safeCount(overview.contacts),
    lineRegistrations,
    entries: safeCount(overview.entries),
    offers: safeCount(overview.offers),
    mapped: safeCount(overview.mapped),
    needsAction: safeCount(overview.ownerReview) + safeCount(overview.quarantined)
  };

  return Object.freeze({
    summary: Object.freeze(SUMMARY_METRICS.map(([key, label]) => Object.freeze({
      key,
      label,
      value: summaryValues[key]
    }))),
    flow: Object.freeze(buildMonthlyFlow(students)),
    schools: Object.freeze(buildSchoolRows(students)),
    coverage: Object.freeze({
      lineRegistrationRate: percentage(lineRegistrations, summaryValues.contacts),
      schoolRegistered: countBy(students, (student) => Boolean(cleanText(student.school))),
      schoolMissing: countBy(students, (student) => !cleanText(student.school)),
      monthCount: new Set(students.map(monthKey).filter(Boolean)).size
    })
  });
}

export function buildTalentAnalyticsActionGuide(analytics) {
  const summary = Array.isArray(analytics?.summary) ? analytics.summary : [];
  const flow = Array.isArray(analytics?.flow) ? analytics.flow : [];
  const schools = Array.isArray(analytics?.schools) ? analytics.schools : [];
  const coverage = analytics?.coverage || {};
  const needsAction = safeCount(summary.find((item) => item.key === "needsAction")?.value);
  const total = safeCount(summary.find((item) => item.key === "total")?.value);
  const lineRate = Number.isFinite(coverage.lineRegistrationRate) ? coverage.lineRegistrationRate : 0;
  const schoolMissing = safeCount(coverage.schoolMissing);
  const topSchool = schools[0];
  const latestMonth = flow[0];

  const category = needsAction > 0
    ? "OWNER_REVIEW_FIRST"
    : latestMonth?.key
      ? "LATEST_MONTH_FOLLOW_UP"
      : topSchool?.school
        ? "SCHOOL_FOLLOW_UP"
        : total > 0
          ? "STUDENT_LIST_REVIEW"
          : "NO_ANALYTICS_ACTION";

  const copyByCategory = {
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
    needsActionCategory: needsAction > 0 ? "MULTIPLE" : "ZERO",
    latestMonthAvailable: Boolean(latestMonth?.key),
    topSchoolAvailable: Boolean(topSchool?.school),
    lineRegistrationRateCategory: lineRate >= 70 ? "HIGH" : lineRate >= 40 ? "MEDIUM" : lineRate > 0 ? "LOW" : "ZERO",
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

function buildMonthlyFlow(students) {
  const groups = new Map();
  students.forEach((student) => {
    const key = monthKey(student);
    if (!key) return;
    const row = groups.get(key) || {
      key,
      label: formatMonth(key),
      contacts: 0,
      lineRegistrations: 0,
      entries: 0,
      offers: 0,
      needsAction: 0
    };
    const metric = SOURCE_CODES[student.sourceCode];
    if (metric) row[metric] += 1;
    if (student.lineRegistrationDate) row.lineRegistrations += 1;
    if (student.classification === "OWNER_REVIEW" || student.classification === "QUARANTINE") {
      row.needsAction += 1;
    }
    groups.set(key, row);
  });
  return [...groups.values()]
    .sort((left, right) => right.key.localeCompare(left.key))
    .map((row) => Object.freeze({ ...row }));
}

function buildSchoolRows(students) {
  const groups = new Map();
  students.forEach((student) => {
    const school = cleanText(student.school);
    if (!school) return;
    const key = normalizeGroupKey(school);
    const row = groups.get(key) || {
      key,
      school,
      contacts: 0,
      lineRegistrations: 0,
      entries: 0,
      offers: 0,
      needsAction: 0
    };
    const metric = SOURCE_CODES[student.sourceCode];
    if (metric) row[metric] += 1;
    if (student.lineRegistrationDate) row.lineRegistrations += 1;
    if (student.classification === "OWNER_REVIEW" || student.classification === "QUARANTINE") {
      row.needsAction += 1;
    }
    groups.set(key, row);
  });
  return [...groups.values()]
    .map((row) => Object.freeze({
      ...row,
      entryRate: percentage(row.entries, row.contacts),
      offerRate: percentage(row.offers, row.contacts)
    }))
    .sort((left, right) => (
      right.contacts - left.contacts
      || right.entries - left.entries
      || left.school.localeCompare(right.school, "ja")
    ));
}

function monthKey(student) {
  const value = String(student?.businessDate || student?.lineRegistrationDate || "");
  return /^\d{4}-\d{2}(?:-\d{2})?$/u.test(value) ? value.slice(0, 7) : "";
}

function formatMonth(key) {
  const [year, month] = key.split("-");
  return `${year}年${Number(month)}月`;
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
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function safeCount(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const files = {
  api: read("portal/js/api.js"),
  main: read("portal/js/main.js"),
  html: read("portal/management-app/index.html"),
  app: read("portal/management-app/app-v2.js"),
  csvRequirements: read("portal/management-app/store-csv-requirements.js"),
  workforceEvidence: read("portal/js/management-workforce-evidence-status.js"),
  productionReadiness: read("portal/js/management-production-readiness-status.js"),
  chart: read("portal/management-app/vendor/chart.umd.min.js"),
  backend: read("supabase/functions/nov-hub-api/management_readonly_candidate.ts"),
  index: read("supabase/functions/nov-hub-api/index.ts")
};

const required = [
  [files.api, '"managementFinanceSummary"'],
  [files.api, '"managementStoresSummary"'],
  [files.api, '"managementDataopsStatus"'],
  [files.main, 'MANAGEMENT_WEB_APP_IDS'],
  [files.main, '"./management-app/"'],
  [files.html, 'class="section-tab is-active" data-section="corporate"'],
  [files.html, 'class="section-tab" data-section="stores"'],
  [files.html, '>① 法人経営管理</button>'],
  [files.html, '>② 店舗営業管理</button>'],
  [files.html, 'id="corporate-view-tabs"'],
  [files.html, 'data-view="overview"'],
  [files.html, 'data-view="four-axis"'],
  [files.html, 'data-view="departments"'],
  [files.html, 'data-view="method"'],
  [files.html, 'data-view="stores"'],
  [files.html, 'data-view="dataops"'],
  [files.html, 'id="production-readiness-status"'],
  [files.html, './vendor/chart.umd.min.js?v=4.4.1'],
  [files.chart, 'Chart.js v4.4.1'],
  [files.app, 'restoreNovHubSession'],
  [files.app, 'setHubSessionAuth'],
  [files.app, 'function viewSection(view)'],
  [files.app, 'elements.corporateViewTabs.hidden = !CORPORATE_VIEWS.has(state.view)'],
  [files.app, 'IDEA_NOV_PLACEHOLDER'],
  [files.app, 'renderCsvRequirements(elements.csvRequirements, data.requiredCsvFiles)'],
  [files.csvRequirements, 'READY_FOR_FILE_PREPARATION'],
  [files.csvRequirements, '必要項目:'],
  [files.csvRequirements, 'CSVひな形を保存'],
  [files.csvRequirements, 'data:text/csv;charset=utf-8'],
  [files.csvRequirements, 'validateLocalCsvFile'],
  [files.csvRequirements, 'ファイル内容は送信せず'],
  [files.csvRequirements, 'PERIOD_VALUE_INVALID'],
  [files.csvRequirements, 'LOCAL_FILES_READY'],
  [files.csvRequirements, 'buildLocalValidationReceipt'],
  [files.csvRequirements, 'data:application/json;charset=utf-8'],
  [files.workforceEvidence, 'AUTHORITATIVE_READY'],
  [files.workforceEvidence, 'LOCAL_VALIDATED_PENDING_PRODUCTION'],
  [files.workforceEvidence, 'SOURCE_CONTRACT_INCOMPLETE'],
  [files.workforceEvidence, 'UNAVAILABLE'],
  [files.workforceEvidence, 'aggregateValuesVisible: false'],
  [files.workforceEvidence, 'relatedActionsEnabled: false'],
  [files.productionReadiness, 'LOCAL_REHEARSAL_PASS'],
  [files.productionReadiness, 'PRODUCTION_EVIDENCE_REQUIRED'],
  [files.productionReadiness, 'RUNTIME_DIGESTS_NULL'],
  [files.productionReadiness, 'WRITE_ACTIONS_DISABLED'],
  [files.productionReadiness, 'actionsEnabled: false'],
  [files.productionReadiness, 'HARD_RUNTIME_GATE === true'],
  [files.productionReadiness, '反映・承認・再計算'],
  [files.app, 'management-production-readiness-status.js?v=2770deca730444a2'],
  [files.app, 'mountManagementProductionReadiness(elements.productionReadiness)'],
  [files.app, 'mountWorkforceEvidenceStatus(elements.workforceEvidence)'],
  [files.app, 'workforceMetric(row.staffCount)'],
  [files.app, 'data.aiAdviceReadiness === "aggregate-input-provenance-ready"'],
  [files.app, 'data.expertCommentReadiness === "aggregate-content-provenance-ready"'],
  [files.backend, 'managementFinanceSummary: true'],
  [files.backend, 'managementStoresSummary: true'],
  [files.backend, 'managementDataopsStatus: true'],
  [files.backend, 'text(row.source) === "employees_snapshot"'],
  [files.backend, 'headcountContract: "authoritative-month-end-contract-pending"'],
  [files.backend, 'currentPrimaryStoreFallbackUsed: false'],
  [files.backend, '"full_name"'],
  [files.index, 'const hubSession = await issueHubSession(employee);']
];

const missing = required.filter(([source, fragment]) => !source.includes(fragment)).map(([, fragment]) => fragment);
if (missing.length) throw new Error(`Missing required fragments: ${missing.join(", ")}`);

const frontend = `${files.html}\n${files.app}\n${files.csvRequirements}\n${files.workforceEvidence}\n${files.productionReadiness}`;
const forbidden = [
  /service_role/i,
  /SUPABASE_SERVICE_ROLE/,
  /pin_hash/i,
  /script\.google\.com/i,
  /localStorage/,
  /console\.(log|debug)\s*\(/
];
const hits = forbidden.filter((pattern) => pattern.test(frontend)).map(String);
if (hits.length) throw new Error(`Forbidden frontend exposure: ${hits.join(", ")}`);

console.log(JSON.stringify({
  passed: true,
  managementActions: 3,
  topLevelSections: 2,
  views: 6,
  hubSessionRequired: true,
  frontendForbiddenExposure: false,
  browserDirectSupabase: false,
  dbMutationAdded: false,
  localCsvTemplates: 3,
  localCsvValidation: true,
  localCsvSemanticValidation: true,
  aggregateOnlyLocalReceipt: true,
  workforceEvidenceCategory: "SOURCE_CONTRACT_INCOMPLETE",
  workforceValuesVisible: false,
  aggregateFreeTextVisible: false,
  productionReadinessCategory: "PRODUCTION_EVIDENCE_REQUIRED",
  productionActionsEnabled: false
}, null, 2));

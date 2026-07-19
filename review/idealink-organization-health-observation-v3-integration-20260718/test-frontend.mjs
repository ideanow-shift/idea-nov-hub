import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderOrganizationHealthObservationResponse } from "../../portal/idea-link-app/organization-health-observation.js";

const period = (n) => ({ periodStart: "2026-06-01", periodEnd: "2026-06-28", posts: 10, participationRate: n, senderCoverage: n, receiverCoverage: n, uniquePairCount: 8, categoryCount: 2, crossStoreRate: 0, concentrationRate: n });
const response = () => ({ aggregateOnly: true, externalSend: false, mutation: false, ok: true, result: { contract: "IDEA_LINK_ORGANIZATION_HEALTH_MONITORING_V2_CANDIDATE", safeguards: { aggregateOnly: true, automatedEmploymentDecision: false, individualRanking: false, maximumPeriods: 13, minimumCohort: 5, rawTextIncluded: false, turnoverPrediction: false }, stores: [{ availability: "AGGREGATE_READY", periods: [period(.4), period(.6)], storeLabel: "東久留米店" }] }, selectOnly: true });
let passed = 0; const test = (fn) => { fn(); passed += 1; };
test(() => { const target = { innerHTML: "" }; renderOrganizationHealthObservationResponse(target, response()); assert.match(target.innerHTML, /前期間より増加/); });
test(() => { const target = { innerHTML: "" }; const value = response(); value.result.stores[0].storeLabel = "<script>"; renderOrganizationHealthObservationResponse(target, value); assert.match(target.innerHTML, /&lt;script&gt;/); });
test(() => { const value = response(); value.extra = true; assert.throws(() => renderOrganizationHealthObservationResponse({}, value)); });
test(() => { const value = response(); value.mutation = true; assert.throws(() => renderOrganizationHealthObservationResponse({}, value)); });
test(() => { const value = response(); value.result.stores[0].periods[0].employeeId = "blocked"; assert.throws(() => renderOrganizationHealthObservationResponse({}, value)); });
test(() => { const value = response(); value.result.stores[0].periods = [period(.4)]; const target = { innerHTML: "" }; renderOrganizationHealthObservationResponse(target, value); assert.match(target.innerHTML, /2期間分/); });
const html = await readFile(new URL("../../portal/idea-link-app/index.html", import.meta.url), "utf8");
const api = await readFile(new URL("../../portal/js/api.js", import.meta.url), "utf8");
test(() => assert.match(html, /data-admin-section-target="health"/));
test(() => assert.match(html, /ideaLinkOrganizationHealthMonitoringRead/));
test(() => assert.match(api, /"ideaLinkOrganizationHealthMonitoringRead"/));
test(() => assert.doesNotMatch(html.slice(html.indexOf("loadOrganizationHealthObservation"), html.indexOf("function renderStoreOptions")), /enqueue|sendScoped|notificationId/));
console.log(JSON.stringify({ scenarios: 10, passed, mutation: false, send: false }));



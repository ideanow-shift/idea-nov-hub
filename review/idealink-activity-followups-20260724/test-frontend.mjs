import assert from "node:assert/strict";
import { renderOrganizationHealthObservationResponse } from "../../portal/idea-link-app/organization-health-observation.js";

const period = (value) => ({
  periodStart: "2026-06-01",
  periodEnd: "2026-06-28",
  posts: 10,
  participationRate: value,
  senderCoverage: value,
  receiverCoverage: value,
  uniquePairCount: 8,
  categoryCount: 2,
  crossStoreRate: 0,
  concentrationRate: value,
});
const safeguards = {
  aggregateOnly: true,
  automatedEmploymentDecision: false,
  followupFreeText: false,
  followupStatusesOnly: true,
  individualRanking: false,
  individualSupportSignals: true,
  maximumPeriods: 13,
  minimumCohort: 5,
  rawTextIncluded: false,
  supportSignalMeaning: "CONVERSATION_PROMPT_ONLY",
  turnoverPrediction: false,
};
const response = () => ({
  aggregateOnly: true,
  externalSend: false,
  mutation: false,
  ok: true,
  result: {
    contract: "IDEA_LINK_ORGANIZATION_HEALTH_MONITORING_V4",
    safeguards: { ...safeguards },
    stores: [{
      activitySignalOverflow: false,
      activitySignals: [{
        employeeLabel: "対象者",
        signalCategories: ["PUBLIC_RECEIVE_ACTIVITY_STOPPED"],
        targetEmployeeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }],
      availability: "AGGREGATE_READY",
      followups: [],
      periods: [period(.6), period(.4)],
      storeLabel: "立川店",
    }],
  },
  selectOnly: true,
});
const target = () => ({ innerHTML: "", querySelectorAll: () => [] });
let passed = 0;
const test = (fn) => { fn(); passed += 1; };
test(() => {
  const node = target();
  renderOrganizationHealthObservationResponse(node, response(), async () => {});
  assert.match(node.innerHTML, /公開投稿を受け取っていません|受け取っていた公開投稿/);
  assert.match(node.innerHTML, /対応状況/);
  assert.match(node.innerHTML, /次回確認日/);
});
test(() => {
  const node = target();
  const value = response();
  value.result.stores[0].storeLabel = "<script>";
  renderOrganizationHealthObservationResponse(node, value);
  assert.match(node.innerHTML, /&lt;script&gt;/);
});
test(() => {
  const value = response();
  value.result.safeguards.followupFreeText = true;
  assert.throws(() => renderOrganizationHealthObservationResponse(target(), value));
});
test(() => {
  const value = response();
  value.result.stores[0].activitySignals[0].score = 90;
  assert.throws(() => renderOrganizationHealthObservationResponse(target(), value));
});
test(() => {
  const node = target();
  renderOrganizationHealthObservationResponse(node, response());
  assert.doesNotMatch(node.innerHTML, /textarea|自由記述|離職予測|ランキング/);
});
test(() => {
  const node = target();
  const value = response();
  value.result.stores.push({
    ...structuredClone(value.result.stores[0]),
    storeLabel: "吉祥寺店",
  });
  renderOrganizationHealthObservationResponse(node, value);
  assert.match(node.innerHTML, /role="tablist"/);
  assert.match(node.innerHTML, /role="tab"[^>]*aria-selected="true"[^>]*>立川店<\/button>/);
  assert.match(node.innerHTML, /role="tab"[^>]*aria-selected="false"[^>]*>吉祥寺店<\/button>/);
  assert.match(node.innerHTML, /role="tabpanel"[^>]*data-store-panel="1" hidden/);
});
console.log(JSON.stringify({ scenarios: 6, passed }));

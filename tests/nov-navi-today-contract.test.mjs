import assert from "node:assert/strict";
import {
  getNovNaviTodaySnapshot,
  isNovNaviTodayEnvelope,
  NOV_NAVI_TODAY_SCHEMA,
  NOV_NAVI_TODAY_SOURCES
} from "../portal/js/nov-navi-today-contract.js";

assert.deepEqual(
  getNovNaviTodaySnapshot({ schedule: 1, tasks: 2, approvals: 0, thanks: 4, inquiries: 3, growthPoints: 8 }),
  [1, 2, 0, 4, 3, 8]
);
assert.deepEqual(getNovNaviTodaySnapshot({ schedule: -1, tasks: "2" }), [null, null, null, null, null, null]);
assert.equal(
  isNovNaviTodayEnvelope({ schema: NOV_NAVI_TODAY_SCHEMA, aggregates: { tasks: 2, approvals: 0 } }),
  true
);
assert.equal(
  isNovNaviTodayEnvelope({ schema: NOV_NAVI_TODAY_SCHEMA, aggregates: { tasks: 2 }, employeeId: "not-allowed" }),
  false
);
assert.equal(isNovNaviTodayEnvelope({ schema: "other", aggregates: {} }), false);
assert.deepEqual(Object.keys(NOV_NAVI_TODAY_SOURCES).sort(), ["approvals", "growthPoints", "inquiries", "schedule", "tasks", "thanks"]);

console.log("NOV NAVI Today contract fixtures: PASS");

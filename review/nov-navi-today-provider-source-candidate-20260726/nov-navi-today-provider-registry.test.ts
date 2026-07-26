import {
  getNovNaviTodayProviderContract,
  isNovNaviTodayRuntimeField,
  NOV_NAVI_TODAY_HELD_FIELDS,
  NOV_NAVI_TODAY_RUNTIME_FIELDS,
} from "./nov-navi-today-provider-registry.ts";

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

Deno.test("only the five owner-confirmation candidates are runtime fields", () => {
  assert(NOV_NAVI_TODAY_RUNTIME_FIELDS.length === 5, "unexpected runtime field count");
  assert(!Array.from<string>(NOV_NAVI_TODAY_RUNTIME_FIELDS).includes("inquiries"), "inquiries must remain held");
  assert(NOV_NAVI_TODAY_HELD_FIELDS.length === 1, "unexpected held field count");
  assert(NOV_NAVI_TODAY_HELD_FIELDS[0] === "inquiries", "inquiries hold missing");
});

Deno.test("runtime contracts have one bounded server-side aggregate read", () => {
  NOV_NAVI_TODAY_RUNTIME_FIELDS.forEach((field) => {
    const contract = getNovNaviTodayProviderContract(field);
    assert(contract !== null, `${field} contract missing`);
    if (contract === null) throw new Error(`${field} contract missing`);
    assert(contract.maximumReads === 1, `${field} maximum read mismatch`);
    assert(contract.purpose.startsWith("nov_navi."), `${field} purpose mismatch`);
  });
});

Deno.test("held and unknown fields cannot resolve a provider contract", () => {
  assert(getNovNaviTodayProviderContract("inquiries") === null, "held field resolved");
  assert(getNovNaviTodayProviderContract("employeeId") === null, "unknown field resolved");
  assert(!isNovNaviTodayRuntimeField("inquiries"), "held field is runtime");
});

import { buildNovNaviTodayEnvelope, NOV_NAVI_TODAY_ACTION, NOV_NAVI_TODAY_SCHEMA } from "./nov-navi-today-provider-candidate.ts";

function assertEquals(actual: unknown, expected: unknown) {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  if (left !== right) throw new Error(`Expected ${right}, received ${left}`);
}

async function assertRejects(operation: () => Promise<unknown>, expectedMessage: string) {
  try {
    await operation();
  } catch (error) {
    if (error instanceof Error && error.message === expectedMessage) return;
    throw error;
  }
  throw new Error("Expected operation to reject");
}

Deno.test("uses the fixed HUB action name", () => {
  assertEquals(NOV_NAVI_TODAY_ACTION, "novNaviTodayRead");
});

Deno.test("returns only verified aggregate values", async () => {
  const values: Partial<Record<"schedule" | "tasks" | "approvals" | "thanks" | "inquiries" | "growthPoints", number>> = {
    tasks: 3,
    approvals: 0,
  };
  const result = await buildNovNaviTodayEnvelope(
    { active: true, loginEnabled: true },
    async (field) => values[field],
  );
  assertEquals(result, { ok: true, schema: NOV_NAVI_TODAY_SCHEMA, aggregates: { tasks: 3, approvals: 0 } });
});

Deno.test("omits unavailable, invalid, and failed provider fields", async () => {
  const result = await buildNovNaviTodayEnvelope(
    { active: true, loginEnabled: true },
    async (field) => {
      if (field === "schedule") throw new Error("provider unavailable");
      if (field === "tasks") return "3";
      if (field === "thanks") return 2;
      return undefined;
    },
  );
  assertEquals(result.aggregates, { thanks: 2 });
});

Deno.test("fails closed before any provider read for inactive login", async () => {
  let calls = 0;
  await assertRejects(
    () => buildNovNaviTodayEnvelope({ active: false, loginEnabled: true }, async () => {
      calls += 1;
      return 1;
    }),
    "AUTH_REQUIRED",
  );
  assertEquals(calls, 0);
});

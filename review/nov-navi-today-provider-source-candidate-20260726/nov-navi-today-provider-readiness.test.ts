import {
  getNovNaviTodayReadyFields,
  NOV_NAVI_TODAY_OWNER_CONFIRMATIONS_PENDING,
} from "./nov-navi-today-provider-readiness.ts";

const assertEquals = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
};

function assertThrows(operation: () => unknown, expected: string) {
  try {
    operation();
  } catch (error) {
    if (error instanceof Error && error.message === expected) return;
    throw error;
  }
  throw new Error("Expected operation to throw");
}

Deno.test("pending owner confirmations enable no provider", () => {
  assertEquals(getNovNaviTodayReadyFields(NOV_NAVI_TODAY_OWNER_CONFIRMATIONS_PENDING), []);
});

Deno.test("both confirmations are required for each provider", () => {
  const confirmations = {
    ...NOV_NAVI_TODAY_OWNER_CONFIRMATIONS_PENDING,
    thanks: { definitionConfirmed: true, authorizationConfirmed: true },
    tasks: { definitionConfirmed: true, authorizationConfirmed: false },
  };
  assertEquals(getNovNaviTodayReadyFields(confirmations), ["thanks"]);
});

Deno.test("missing or browser-added provider keys fail closed", () => {
  const missing = { ...NOV_NAVI_TODAY_OWNER_CONFIRMATIONS_PENDING } as Record<string, unknown>;
  delete missing.tasks;
  assertThrows(() => getNovNaviTodayReadyFields(missing as never), "TODAY_PROVIDER_CONFIRMATION_INVALID");

  const extra = { ...NOV_NAVI_TODAY_OWNER_CONFIRMATIONS_PENDING, inquiries: {} } as never;
  assertThrows(() => getNovNaviTodayReadyFields(extra), "TODAY_PROVIDER_CONFIRMATION_INVALID");
});

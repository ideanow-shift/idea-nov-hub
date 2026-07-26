import { NOV_NAVI_TODAY_RUNTIME_FIELDS, type NovNaviTodayRuntimeField } from "./nov-navi-today-provider-registry.ts";

export const NOV_NAVI_TODAY_ACTION = "novNaviTodayRead";
export const NOV_NAVI_TODAY_SCHEMA = "nov-navi-today-v1";

type Aggregate = Partial<Record<NovNaviTodayRuntimeField, number>>;

export type TodayActor = {
  active: boolean;
  loginEnabled: boolean;
};

export type TodayProvider = (field: NovNaviTodayRuntimeField) => Promise<unknown>;

function isAggregate(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000;
}

export async function buildNovNaviTodayEnvelope(
  actor: TodayActor,
  readAggregate: TodayProvider,
): Promise<{ ok: true; schema: string; aggregates: Aggregate }> {
  if (actor.active !== true || actor.loginEnabled !== true) {
    throw new Error("AUTH_REQUIRED");
  }

  const settled = await Promise.allSettled(NOV_NAVI_TODAY_RUNTIME_FIELDS.map((field) => readAggregate(field)));
  const aggregates: Aggregate = {};
  settled.forEach((result, index) => {
    if (result.status === "fulfilled" && isAggregate(result.value)) {
      aggregates[NOV_NAVI_TODAY_RUNTIME_FIELDS[index]] = result.value;
    }
  });

  return { ok: true, schema: NOV_NAVI_TODAY_SCHEMA, aggregates };
}

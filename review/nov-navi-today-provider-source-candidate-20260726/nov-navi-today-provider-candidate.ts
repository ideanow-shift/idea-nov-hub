export const NOV_NAVI_TODAY_ACTION = "novNaviTodayRead";
export const NOV_NAVI_TODAY_SCHEMA = "nov-navi-today-v1";

const TODAY_FIELDS = ["schedule", "tasks", "approvals", "thanks", "inquiries", "growthPoints"] as const;
type TodayField = typeof TODAY_FIELDS[number];
type Aggregate = Partial<Record<TodayField, number>>;

export type TodayActor = {
  active: boolean;
  loginEnabled: boolean;
};

export type TodayProvider = (field: TodayField) => Promise<unknown>;

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

  const settled = await Promise.allSettled(TODAY_FIELDS.map((field) => readAggregate(field)));
  const aggregates: Aggregate = {};
  settled.forEach((result, index) => {
    if (result.status === "fulfilled" && isAggregate(result.value)) {
      aggregates[TODAY_FIELDS[index]] = result.value;
    }
  });

  return { ok: true, schema: NOV_NAVI_TODAY_SCHEMA, aggregates };
}

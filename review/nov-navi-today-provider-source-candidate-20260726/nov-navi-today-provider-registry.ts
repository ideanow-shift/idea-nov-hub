export const NOV_NAVI_TODAY_RUNTIME_FIELDS = [
  "schedule",
  "tasks",
  "approvals",
  "thanks",
  "growthPoints",
] as const;

export const NOV_NAVI_TODAY_HELD_FIELDS = ["inquiries"] as const;

export type NovNaviTodayRuntimeField = typeof NOV_NAVI_TODAY_RUNTIME_FIELDS[number];
export type NovNaviTodayHeldField = typeof NOV_NAVI_TODAY_HELD_FIELDS[number];

type ProviderContract = Readonly<{
  owner: string;
  purpose: string;
  actorScope: "current_employee" | "current_approver" | "idea_link_employee";
  maximumReads: 1;
}>;

const PROVIDER_CONTRACTS: Readonly<Record<NovNaviTodayRuntimeField, ProviderContract>> = {
  schedule: {
    owner: "attendance_shift",
    purpose: "nov_navi.schedule_today_count",
    actorScope: "current_employee",
    maximumReads: 1,
  },
  tasks: {
    owner: "task_manager",
    purpose: "nov_navi.open_task_count",
    actorScope: "current_employee",
    maximumReads: 1,
  },
  approvals: {
    owner: "decision_hub",
    purpose: "nov_navi.pending_approval_count",
    actorScope: "current_approver",
    maximumReads: 1,
  },
  thanks: {
    owner: "idea_link",
    purpose: "nov_navi.received_thanks_count",
    actorScope: "idea_link_employee",
    maximumReads: 1,
  },
  growthPoints: {
    owner: "growth",
    purpose: "nov_navi.monthly_growth_points",
    actorScope: "current_employee",
    maximumReads: 1,
  },
};

export function getNovNaviTodayProviderContract(field: string): ProviderContract | null {
  if (!NOV_NAVI_TODAY_RUNTIME_FIELDS.includes(field as NovNaviTodayRuntimeField)) {
    return null;
  }
  return PROVIDER_CONTRACTS[field as NovNaviTodayRuntimeField];
}

export function isNovNaviTodayRuntimeField(field: string): field is NovNaviTodayRuntimeField {
  return NOV_NAVI_TODAY_RUNTIME_FIELDS.includes(field as NovNaviTodayRuntimeField);
}

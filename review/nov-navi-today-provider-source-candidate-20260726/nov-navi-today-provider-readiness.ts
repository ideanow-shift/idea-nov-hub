import {
  NOV_NAVI_TODAY_RUNTIME_FIELDS,
  type NovNaviTodayRuntimeField,
} from "./nov-navi-today-provider-registry.ts";

export type NovNaviTodayOwnerConfirmation = Readonly<{
  definitionConfirmed: boolean;
  authorizationConfirmed: boolean;
}>;

export type NovNaviTodayReadiness = Readonly<Record<NovNaviTodayRuntimeField, NovNaviTodayOwnerConfirmation>>;

export const NOV_NAVI_TODAY_OWNER_CONFIRMATIONS_PENDING: NovNaviTodayReadiness = {
  schedule: { definitionConfirmed: false, authorizationConfirmed: false },
  tasks: { definitionConfirmed: false, authorizationConfirmed: false },
  approvals: { definitionConfirmed: false, authorizationConfirmed: false },
  thanks: { definitionConfirmed: false, authorizationConfirmed: false },
  growthPoints: { definitionConfirmed: false, authorizationConfirmed: false },
};

function hasExactRuntimeFieldKeys(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value).sort();
  const expected = [...NOV_NAVI_TODAY_RUNTIME_FIELDS].sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

export function getNovNaviTodayReadyFields(
  confirmations: NovNaviTodayReadiness,
): NovNaviTodayRuntimeField[] {
  if (!hasExactRuntimeFieldKeys(confirmations)) {
    throw new Error("TODAY_PROVIDER_CONFIRMATION_INVALID");
  }

  return NOV_NAVI_TODAY_RUNTIME_FIELDS.filter((field) => {
    const confirmation = confirmations[field];
    return confirmation.definitionConfirmed === true && confirmation.authorizationConfirmed === true;
  });
}

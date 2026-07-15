export const CURRENT_READINESS = Object.freeze({
  runtimeApprovedDigest: null,
  schemaApplied: false,
  authoritativeResolverInstalled: false,
  runtimeWired: false,
  currentReady: false,
});

export function inspectCorporationScopeSubstrate({ substrate, cutover, down, catalog }) {
  if (![substrate, cutover, down, catalog].every((value) => typeof value === "string")) return null;
  const required = [
    "CORPORATION_SCOPE_TARGET_NOT_EXACT",
    "CORPORATION_SCOPE_OWNER_ATTRIBUTES_MISMATCH",
    "CORPORATION_SCOPE_OWNER_MEMBERSHIP_NOT_ZERO",
    "CORPORATION_SCOPE_PROVIDER_OBJECT_COLLISION",
    "create role classification_corporation_scope_provider_owner",
    "nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls",
    "create function public.read_finance_classification_corporation_scope_provider_status",
    "create function public.resolve_finance_classification_corporation_scope(p_rule_id uuid)",
    "'CORPORATION_SCOPE_PROVIDER_NOT_READY'::text, false, false, false, false",
    "CORPORATION_SCOPE_PROVIDER_UNAPPROVED_EXECUTE",
  ];
  if (!required.every((needle) => substrate.includes(needle))) return null;
  if (/create\s+or\s+replace|create\s+trigger|grant\s+(execute|update|insert|delete)/i.test(substrate)) return null;
  if (/\b(actor|employee|role|permission|corporation|scope|provider)_?(resolved|ready|id|key)?\s+(boolean|text|uuid)/i.test(
    substrate.slice(substrate.indexOf("resolve_finance_classification_corporation_scope(p_rule_id uuid)"), substrate.indexOf("returns table", substrate.indexOf("resolve_finance_classification_corporation_scope(p_rule_id uuid)"))),
  )) return null;
  const resolverStart = substrate.indexOf("create function public.resolve_finance_classification_corporation_scope");
  const resolverEnd = substrate.indexOf("alter function public.resolve_finance_classification_corporation_scope", resolverStart);
  const resolverBody = substrate.slice(resolverStart, resolverEnd).replace(/^\s*--.*$/gm, "");
  if (resolverStart < 0 || resolverEnd < 0 || /\b(insert|update|delete|merge)\b/i.test(resolverBody)) return null;
  if (!cutover.includes("CUTOVER_INELIGIBLE_SIX_PROVIDER_IDENTITIES_NOT_READY")) return null;
  if (!down.includes("RUNTIME-DISCONNECTED BOUNDARY") || !down.includes("drop role classification_corporation_scope_provider_owner")) return null;
  for (const needle of ["CORPORATION_SCOPE_SUBSTRATE_PREAPPLY_READY", "TARGET_NOT_EXACT", "CORPORATION_SCOPE_OBJECT_COLLISION", "CORPORATION_SCOPE_ENFORCEMENT_PRESENT"]) {
    if (!catalog.includes(needle)) return null;
  }
  const catalogCode = catalog.replace(/^\s*--.*$/gm, "");
  if (/\b(insert|update|delete|merge|alter|create|drop|grant|revoke|truncate)\b/i.test(catalogCode)) return null;
  return Object.freeze({
    nonDisruptive: true,
    businessSchemaChanges: 0,
    authoritativeResolverInstalled: false,
    triggerCount: 0,
    browserAssertionsAccepted: false,
    directRuntimeExecuteGrants: 0,
    catalogSelectOnly: true,
    currentReady: false,
  });
}

export function validateSanitizedStatus(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort().join("|");
  if (keys !== ["actorResolverInstalled", "category", "providerReady", "runtimeWired", "targetResolverInstalled"].sort().join("|")) return false;
  return value.category === "CORPORATION_SCOPE_PROVIDER_NOT_READY"
    && value.providerReady === false
    && value.actorResolverInstalled === false
    && value.targetResolverInstalled === false
    && value.runtimeWired === false;
}

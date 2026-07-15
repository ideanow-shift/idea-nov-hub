export const CURRENT_READINESS = Object.freeze({
  runtimeApprovedDigest: null,
  schemaApplied: false,
  authoritativeResolverInstalled: false,
  snapshotBindingInstalled: false,
  runtimeWired: false,
  currentReady: false,
});

export function inspectSourceOwnershipSubstrate({ substrate, cutover, down, catalog }) {
  if (![substrate, cutover, down, catalog].every((value) => typeof value === "string")) return null;
  const required = [
    "SOURCE_OWNERSHIP_TARGET_NOT_EXACT",
    "SOURCE_OWNERSHIP_OWNER_ATTRIBUTES_MISMATCH",
    "SOURCE_OWNERSHIP_OWNER_MEMBERSHIP_NOT_ZERO",
    "SOURCE_OWNERSHIP_PROVIDER_OBJECT_COLLISION",
    "create role classification_source_ownership_provider_owner",
    "nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls",
    "create function public.read_finance_classification_source_ownership_provider_status",
    "create function public.resolve_finance_classification_source_ownership(p_rule_id uuid)",
    "'SOURCE_OWNERSHIP_PROVIDER_NOT_READY'::text, false, false, false, false",
    "SOURCE_OWNERSHIP_PROVIDER_UNAPPROVED_EXECUTE",
  ];
  if (!required.every((needle) => substrate.includes(needle))) return null;
  if (/create\s+or\s+replace|create\s+trigger|grant\s+(execute|update|insert|delete)/i.test(substrate)) return null;
  const signature = substrate.slice(
    substrate.indexOf("resolve_finance_classification_source_ownership(p_rule_id uuid)"),
    substrate.indexOf("returns table", substrate.indexOf("resolve_finance_classification_source_ownership(p_rule_id uuid)")),
  );
  if (/p_(actor|role|owner|source|relation|row|target|ownership|snapshot|provider|ready)/i.test(signature)) return null;
  const resolverStart = substrate.indexOf("create function public.resolve_finance_classification_source_ownership");
  const resolverEnd = substrate.indexOf("alter function public.resolve_finance_classification_source_ownership", resolverStart);
  const resolverBody = substrate.slice(resolverStart, resolverEnd).replace(/^\s*--.*$/gm, "");
  if (resolverStart < 0 || resolverEnd < 0 || /\b(insert|update|delete|merge)\b/i.test(resolverBody)) return null;
  if (!cutover.includes("CUTOVER_INELIGIBLE_SIX_PROVIDER_IDENTITIES_NOT_READY")) return null;
  if (!down.includes("RUNTIME-DISCONNECTED BOUNDARY") || !down.includes("drop role classification_source_ownership_provider_owner")) return null;
  for (const needle of ["SOURCE_OWNERSHIP_SUBSTRATE_PREAPPLY_READY", "TARGET_NOT_EXACT", "SOURCE_OWNERSHIP_OBJECT_COLLISION", "SOURCE_OWNERSHIP_ENFORCEMENT_PRESENT"]) {
    if (!catalog.includes(needle)) return null;
  }
  const catalogCode = catalog.replace(/^\s*--.*$/gm, "");
  if (/\b(insert|update|delete|merge|alter|create|drop|grant|revoke|truncate)\b/i.test(catalogCode)) return null;
  return Object.freeze({ nonDisruptive: true, businessSchemaChanges: 0, authoritativeResolverInstalled: false, snapshotBindingInstalled: false, triggerCount: 0, browserAssertionsAccepted: false, directRuntimeExecuteGrants: 0, catalogSelectOnly: true, currentReady: false });
}

export function validateSanitizedStatus(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort().join("|");
  if (keys !== ["category", "ownerResolverInstalled", "providerReady", "runtimeWired", "snapshotBindingInstalled"].sort().join("|")) return false;
  return value.category === "SOURCE_OWNERSHIP_PROVIDER_NOT_READY"
    && value.providerReady === false
    && value.ownerResolverInstalled === false
    && value.snapshotBindingInstalled === false
    && value.runtimeWired === false;
}

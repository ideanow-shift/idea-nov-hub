export const CURRENT_READINESS = Object.freeze({
  runtimeApprovedDigest: null,
  schemaApplied: false,
  canonicalProviderInstalled: false,
  runtimeWired: false,
  currentReady: false,
});

export function inspectSnapshotSubstrate({ substrate, cutover, down, catalog }) {
  if (![substrate, cutover, down, catalog].every((value) => typeof value === "string")) return null;
  const required = [
    "classification_snapshot text null",
    "^s2:[a-f0-9]{64}$",
    "SNAPSHOT_OWNER_ATTRIBUTES_MISMATCH",
    "SNAPSHOT_OWNER_MEMBERSHIP_NOT_ZERO",
    "SNAPSHOT_COLUMN_COLLISION",
    "SNAPSHOT_PROVIDER_OBJECT_COLLISION",
    "create role classification_snapshot_provider_owner",
    "nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls",
    "create function public.read_finance_classification_snapshot_provider_status",
    "create function public.derive_finance_classification_snapshot",
    "'SNAPSHOT_PROVIDER_NOT_READY'::text, false, false, false",
    "SNAPSHOT_PROVIDER_UNAPPROVED_EXECUTE",
    "revoke update (classification_snapshot)",
  ];
  if (!required.every((needle) => substrate.includes(needle))) return null;
  if (/create\s+or\s+replace|create\s+trigger|grant\s+(execute|update)/i.test(substrate)) return null;
  const deriveStart = substrate.indexOf("create function public.derive_finance_classification_snapshot");
  const deriveEnd = substrate.indexOf("alter function public.derive_finance_classification_snapshot", deriveStart);
  const deriveBody = substrate.slice(deriveStart, deriveEnd).replace(/^\s*--.*$/gm, "");
  if (deriveStart < 0 || deriveEnd < 0 || /\b(insert|update|delete|merge)\b/i.test(deriveBody)) return null;
  if (!cutover.includes("CUTOVER_INELIGIBLE_SIX_PROVIDER_IDENTITIES_NOT_READY")) return null;
  if (!down.includes("DATA-LOSS BOUNDARY") || !down.includes("drop column classification_snapshot")) return null;
  for (const needle of ["SNAPSHOT_SUBSTRATE_PREAPPLY_READY", "TARGET_NOT_EXACT", "SNAPSHOT_OBJECT_COLLISION", "SNAPSHOT_ENFORCEMENT_PRESENT"]) {
    if (!catalog.includes(needle)) return null;
  }
  const catalogCode = catalog.replace(/^\s*--.*$/gm, "");
  if (/\b(insert|update|delete|merge|alter|create|drop|grant|revoke|truncate)\b/i.test(catalogCode)) return null;
  return Object.freeze({
    nonDisruptive: true,
    existingRowsRemainNull: true,
    canonicalGeneratorInstalled: false,
    triggerCount: 0,
    browserEvidenceAccepted: false,
    directRuntimeExecuteGrants: 0,
    catalogSelectOnly: true,
    currentReady: false,
  });
}

export function validateSanitizedStatus(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort().join("|");
  if (keys !== ["canonicalProviderInstalled", "category", "providerReady", "runtimeWired"].sort().join("|")) return false;
  return value.category === "SNAPSHOT_PROVIDER_NOT_READY"
    && value.providerReady === false
    && value.canonicalProviderInstalled === false
    && value.runtimeWired === false;
}

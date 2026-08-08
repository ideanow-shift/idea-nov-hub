// Generated from contracts/nov-talent/selection-coverage/v1.schema.json. Do not edit by hand.
const SCHEMA = Object.freeze({"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"https://ideanov.example/contracts/nov-talent/selection-coverage/v1.schema.json","title":"NOV Talent Selection Coverage Contract v1.0.0","description":"Read-only coverage contract for official Selection facts and unlinked Source Evidence. This contract is independent from Workspace Contract v1.0.0.","x-selection-coverage-contract-version":"1.0.0","$ref":"#/$defs/SelectionCoverageResponseV1","$defs":{"NonNegativeInteger":{"type":"integer","minimum":0},"NullableNonNegativeInteger":{"type":["integer","null"],"minimum":0},"Timestamp":{"type":"string","pattern":"^\\d{4}-\\d{2}-\\d{2}T"},"SelectionCode":{"enum":["APPLICATION_RECEIVED","INTERVIEW_PLANNED","INTERVIEW_COMPLETED","OFFERED","OFFER_ACCEPTED","WITHDRAWN","REJECTED"]},"SelectionCoverageResponseV1":{"type":"object","additionalProperties":false,"required":["ok","data","meta"],"properties":{"ok":{"const":true},"data":{"$ref":"#/$defs/SelectionCoverageDataV1"},"meta":{"$ref":"#/$defs/SelectionCoverageMetaV1"}}},"SelectionCoverageMetaV1":{"type":"object","additionalProperties":false,"required":["generatedAt","requestId","source","version"],"properties":{"generatedAt":{"$ref":"#/$defs/Timestamp"},"requestId":{"type":"string","minLength":1},"source":{"type":"string","minLength":1},"version":{"type":"string","minLength":1}}},"SelectionCoverageDataV1":{"type":"object","additionalProperties":false,"required":["selection_coverage_contract_version","sourceCoverageState","officialSelectionRows","officialUniqueCandidates","unlinkedEvidenceTotal","datedUnlinkedEvidence","undatedUnlinkedEvidence","unlinkedUniqueCandidates","metrics"],"properties":{"selection_coverage_contract_version":{"const":"1.0.0"},"sourceCoverageState":{"enum":["READY","PREPARING"]},"officialSelectionRows":{"$ref":"#/$defs/NullableNonNegativeInteger"},"officialUniqueCandidates":{"$ref":"#/$defs/NullableNonNegativeInteger"},"unlinkedEvidenceTotal":{"$ref":"#/$defs/NullableNonNegativeInteger"},"datedUnlinkedEvidence":{"$ref":"#/$defs/NullableNonNegativeInteger"},"undatedUnlinkedEvidence":{"$ref":"#/$defs/NullableNonNegativeInteger"},"unlinkedUniqueCandidates":{"$ref":"#/$defs/NullableNonNegativeInteger"},"metrics":{"type":"array","maxItems":7,"items":{"$ref":"#/$defs/SelectionCoverageMetricV1"}}}},"SelectionCoverageMetricV1":{"type":"object","additionalProperties":false,"required":["code","officialRows","officialUniqueCandidates","unlinkedEvidenceTotal","datedUnlinkedEvidence","undatedUnlinkedEvidence"],"properties":{"code":{"$ref":"#/$defs/SelectionCode"},"officialRows":{"$ref":"#/$defs/NullableNonNegativeInteger"},"officialUniqueCandidates":{"$ref":"#/$defs/NullableNonNegativeInteger"},"unlinkedEvidenceTotal":{"$ref":"#/$defs/NullableNonNegativeInteger"},"datedUnlinkedEvidence":{"$ref":"#/$defs/NullableNonNegativeInteger"},"undatedUnlinkedEvidence":{"$ref":"#/$defs/NullableNonNegativeInteger"}}}}});
export const SELECTION_COVERAGE_CONTRACT_VERSION = "1.0.0";
export const SELECTION_COVERAGE_CONTRACT_SCHEMA = SCHEMA;

function resolveRef(root, ref) {
  return String(ref).split("/").slice(1).reduce((value, segment) => value?.[segment.replace(/~1/gu, "/").replace(/~0/gu, "~")], root);
}

function validateNode(value, node, root, pathName) {
  if (node.$ref) return validateNode(value, resolveRef(root, node.$ref), root, pathName);
  if (Object.hasOwn(node, "const") && value !== node.const) return { ok: false, path: pathName, rule: "const", expected: node.const, actual: value === null ? "null" : typeof value };
  if (Array.isArray(node.enum) && !node.enum.includes(value)) return { ok: false, path: pathName, rule: "enum", expected: node.enum, actual: value === null ? "null" : typeof value };
  const allowedTypes = Array.isArray(node.type) ? node.type : node.type ? [node.type] : [];
  if (allowedTypes.length) {
    const actualType = value === null ? "null" : Array.isArray(value) ? "array" : Number.isInteger(value) ? "integer" : typeof value === "number" ? "number" : typeof value;
    const typeOk = allowedTypes.includes(actualType) || (actualType === "integer" && allowedTypes.includes("number"));
    if (!typeOk) return { ok: false, path: pathName, rule: "type", expected: allowedTypes, actual: actualType };
  }
  if (value === null) return { ok: true };
  if (node.type === "object") {
    const keys = Object.keys(value);
    for (const required of node.required || []) if (!Object.hasOwn(value, required)) return { ok: false, path: pathName + "." + required, rule: "required", expected: "present", actual: "missing" };
    if (node.additionalProperties === false) for (const key of keys) if (!Object.hasOwn(node.properties || {}, key)) return { ok: false, path: pathName + "." + key, rule: "additionalProperties", expected: "known key", actual: "unknown key" };
    for (const [key, child] of Object.entries(node.properties || {})) if (Object.hasOwn(value, key)) { const result = validateNode(value[key], child, root, pathName + "." + key); if (!result.ok) return result; }
  }
  if (node.type === "array") {
    if (Number.isInteger(node.maxItems) && value.length > node.maxItems) return { ok: false, path: pathName, rule: "maxItems", expected: node.maxItems, actual: value.length };
    for (let index = 0; index < value.length; index += 1) { const result = validateNode(value[index], node.items || {}, root, pathName + "[" + index + "]"); if (!result.ok) return result; }
  }
  if ((typeof value === "number") && Number.isFinite(node.minimum) && value < node.minimum) return { ok: false, path: pathName, rule: "minimum", expected: node.minimum, actual: value };
  if ((typeof value === "string") && Number.isInteger(node.minLength) && value.length < node.minLength) return { ok: false, path: pathName, rule: "minLength", expected: node.minLength, actual: value.length };
  if ((typeof value === "string") && node.pattern && !(new RegExp(node.pattern, "u")).test(value)) return { ok: false, path: pathName, rule: "pattern", expected: node.pattern, actual: "string" };
  return { ok: true };
}

export function validateSelectionCoverageResponse(value) {
  const result = validateNode(value, SCHEMA, SCHEMA, "selectionCoverage");
  return result.ok ? { ok: true, value } : result;
}

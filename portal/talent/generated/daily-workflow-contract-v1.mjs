// Generated from contracts/nov-talent/daily-workflow-v1.schema.json. Do not edit by hand.
const SCHEMA = Object.freeze({"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"https://ideanow-shift.github.io/contracts/nov-talent/daily-workflow-v1.schema.json","x-daily-workflow-contract-version":"1.1.0","title":"NOV Talent Daily Workflow response","type":"object","additionalProperties":false,"required":["ok","data"],"properties":{"ok":{"const":true},"data":{"type":"object","additionalProperties":false,"required":["daily_workflow_contract_version","sourceCoverageState","generatedAt","assignees","communications","nextActions"],"properties":{"daily_workflow_contract_version":{"const":"1.1.0"},"sourceCoverageState":{"enum":["COMPLETE","PREPARING"]},"generatedAt":{"type":"string","format":"date-time"},"assignees":{"type":"array","items":{"$ref":"#/$defs/assignee"}},"communications":{"type":"array","items":{"$ref":"#/$defs/communication"}},"nextActions":{"type":"array","items":{"$ref":"#/$defs/nextAction"}}},"allOf":[{"if":{"type":"object","properties":{"sourceCoverageState":{"const":"PREPARING"}}},"then":{"type":"object","properties":{"assignees":{"type":"array","maxItems":0},"communications":{"type":"array","maxItems":0},"nextActions":{"type":"array","maxItems":0}}}}]}},"$defs":{"nullableString":{"type":["string","null"]},"nullableUuid":{"type":["string","null"],"format":"uuid"},"nullableDate":{"type":["string","null"],"format":"date"},"nullableDateTime":{"type":["string","null"],"format":"date-time"},"assignee":{"type":"object","additionalProperties":false,"required":["employeeId","displayName"],"properties":{"employeeId":{"type":"string","format":"uuid"},"displayName":{"type":"string","minLength":1,"maxLength":120}}},"communication":{"type":"object","additionalProperties":false,"required":["id","candidateId","occurredAt","method","direction","result","summary","awaitingReply","nextFollowUpDate","correctsCommunicationId","correctionReason","correctionCreatedAt","isCorrection","isEffective","version"],"properties":{"id":{"type":"string","format":"uuid"},"candidateId":{"type":"string","format":"uuid"},"occurredAt":{"type":"string","format":"date-time"},"method":{"enum":["LINE","PHONE","EMAIL","IN_PERSON","SCHOOL_RELAY","OTHER"]},"direction":{"enum":["INBOUND","OUTBOUND"]},"result":{"enum":["REACHED","NO_RESPONSE","REPLY_RECEIVED","INFORMATION_SHARED","OTHER"]},"summary":{"type":"string","minLength":1,"maxLength":1000},"awaitingReply":{"type":"boolean"},"nextFollowUpDate":{"$ref":"#/$defs/nullableDate"},"correctsCommunicationId":{"$ref":"#/$defs/nullableUuid"},"correctionReason":{"type":["string","null"],"maxLength":500},"correctionCreatedAt":{"$ref":"#/$defs/nullableDateTime"},"isCorrection":{"type":"boolean"},"isEffective":{"type":"boolean"},"version":{"type":"integer","minimum":1}}},"nextAction":{"type":"object","additionalProperties":false,"required":["id","candidateId","code","dueDate","text","assignedTo","assignedEmployeeId","assigneeState","isMine","state","holdReason","version","creationBasis","originCommunicationId"],"properties":{"id":{"type":"string","format":"uuid"},"candidateId":{"type":"string","format":"uuid"},"code":{"enum":["FOLLOW_UP","SALON_TOUR_FOLLOW_UP","INTERVIEW_FOLLOW_UP","OFFER_FOLLOW_UP"]},"dueDate":{"$ref":"#/$defs/nullableDate"},"text":{"$ref":"#/$defs/nullableString"},"assignedTo":{"$ref":"#/$defs/nullableString"},"assignedEmployeeId":{"$ref":"#/$defs/nullableUuid"},"assigneeState":{"enum":["REGISTERED","UNREGISTERED"]},"isMine":{"type":"boolean"},"state":{"enum":["OPEN","ON_HOLD","COMPLETED","CANCELLED"]},"holdReason":{"$ref":"#/$defs/nullableString"},"version":{"type":"integer","minimum":1},"creationBasis":{"enum":["MANUAL","COMMUNICATION_FOLLOW_UP"]},"originCommunicationId":{"$ref":"#/$defs/nullableUuid"}}}}});
export const DAILY_WORKFLOW_CONTRACT_VERSION = "1.1.0";
export const DAILY_WORKFLOW_CONTRACT_SCHEMA = SCHEMA;

function resolveRef(root, ref) {
  return String(ref).split("/").slice(1).reduce((value, segment) => value?.[segment.replace(/~1/gu, "/").replace(/~0/gu, "~")], root);
}

function formatValid(value, format) {
  if (format === "uuid") return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
  if (format === "date") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
    if (!match) return false;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() + 1 === Number(match[2]) && date.getUTCDate() === Number(match[3]);
  }
  if (format === "date-time") return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u.test(value) && !Number.isNaN(Date.parse(value));
  return true;
}

function validateNode(value, node, root, pathName) {
  if (node.$ref) return validateNode(value, resolveRef(root, node.$ref), root, pathName);
  for (const child of node.allOf || []) { const result = validateNode(value, child, root, pathName); if (!result.ok) return result; }
  if (node.if) {
    const condition = validateNode(value, node.if, root, pathName);
    const branch = condition.ok ? node.then : node.else;
    if (branch) { const result = validateNode(value, branch, root, pathName); if (!result.ok) return result; }
  }
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
  if (typeof value === "number" && Number.isFinite(node.minimum) && value < node.minimum) return { ok: false, path: pathName, rule: "minimum", expected: node.minimum, actual: value };
  if (typeof value === "string" && Number.isInteger(node.minLength) && value.length < node.minLength) return { ok: false, path: pathName, rule: "minLength", expected: node.minLength, actual: value.length };
  if (typeof value === "string" && Number.isInteger(node.maxLength) && value.length > node.maxLength) return { ok: false, path: pathName, rule: "maxLength", expected: node.maxLength, actual: value.length };
  if (typeof value === "string" && node.pattern && !(new RegExp(node.pattern, "u")).test(value)) return { ok: false, path: pathName, rule: "pattern", expected: node.pattern, actual: "string" };
  if (typeof value === "string" && node.format && !formatValid(value, node.format)) return { ok: false, path: pathName, rule: "format", expected: node.format, actual: "string" };
  return { ok: true };
}

export function validateDailyWorkflowResponse(value) {
  const result = validateNode(value, SCHEMA, SCHEMA, "dailyWorkflow");
  return result.ok ? { ok: true, value } : result;
}

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "contracts", "nov-talent", "workspace", "v1.schema.json");
const FRONTEND_TARGET = path.join(ROOT, "portal", "talent", "generated", "workspace-contract-v1.mjs");
const EDGE_TARGET = path.join(ROOT, "supabase", "functions", "nov-talent-staging-api", "workspace-contract-v1.generated.ts");
const CHECK = process.argv.includes("--check");

const schema = JSON.parse(await readFile(SOURCE, "utf8"));
const version = String(schema["x-workspace-contract-version"] || "");
if (!/^\d+\.\d+\.\d+$/u.test(version)) throw new Error("workspace contract version is invalid");

function typeOf(node) {
  if (node.$ref) return node.$ref.split("/").at(-1);
  if (Object.hasOwn(node, "const")) return JSON.stringify(node.const);
  if (Array.isArray(node.enum)) return node.enum.map((value) => JSON.stringify(value)).join(" | ");
  if (Array.isArray(node.type)) return node.type.map((value) => value === "integer" ? "number" : value).join(" | ");
  if (node.type === "array") return `ReadonlyArray<${typeOf(node.items || {})}>`;
  if (node.type === "object") {
    const required = new Set(node.required || []);
    return `{ ${Object.entries(node.properties || {}).map(([key, value]) => `${JSON.stringify(key)}${required.has(key) ? "" : "?"}: ${typeOf(value)};`).join(" ")} }`;
  }
  if (node.type === "integer" || node.type === "number") return "number";
  if (node.type === "boolean") return "boolean";
  if (node.type === "null") return "null";
  if (node.type === "string") return "string";
  return "unknown";
}

const defs = Object.entries(schema.$defs || {}).map(([name, node]) => `export type ${name} = ${typeOf(node)};`).join("\n");
const schemaJson = JSON.stringify(schema);
const validatorSource = `const SCHEMA = Object.freeze(${schemaJson});
export const WORKSPACE_CONTRACT_VERSION = ${JSON.stringify(version)};
export const WORKSPACE_CONTRACT_SCHEMA = SCHEMA;

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
    if (node.uniqueItems === true && new Set(value).size !== value.length) return { ok: false, path: pathName, rule: "uniqueItems", expected: true, actual: false };
    for (let index = 0; index < value.length; index += 1) { const result = validateNode(value[index], node.items || {}, root, pathName + "[" + index + "]"); if (!result.ok) return result; }
  }
  if ((typeof value === "number") && Number.isFinite(node.minimum) && value < node.minimum) return { ok: false, path: pathName, rule: "minimum", expected: node.minimum, actual: value };
  if ((typeof value === "number") && Number.isFinite(node.maximum) && value > node.maximum) return { ok: false, path: pathName, rule: "maximum", expected: node.maximum, actual: value };
  if ((typeof value === "string") && Number.isInteger(node.minLength) && value.length < node.minLength) return { ok: false, path: pathName, rule: "minLength", expected: node.minLength, actual: value.length };
  if ((typeof value === "string") && node.pattern && !(new RegExp(node.pattern, "u")).test(value)) return { ok: false, path: pathName, rule: "pattern", expected: node.pattern, actual: "string" };
  return { ok: true };
}

export function validateWorkspaceResponse(value, { allowLegacyV0 = false } = {}) {
  let normalized = value;
  let legacyUpgraded = false;
  if (allowLegacyV0 && value?.ok === true && value?.data && !Object.hasOwn(value.data, "workspace_contract_version")) {
    normalized = { ...value, data: { ...value.data, workspace_contract_version: WORKSPACE_CONTRACT_VERSION } };
    legacyUpgraded = true;
  }
  const result = validateNode(normalized, SCHEMA, SCHEMA, "workspace");
  return result.ok ? { ok: true, value: normalized, legacyUpgraded } : result;
}
`;

const banner = `// Generated from contracts/nov-talent/workspace/v1.schema.json. Do not edit by hand.\n`;
const frontend = banner + validatorSource;
const edgeTypes = `type JsonSchema = Record<string, any>;
type ValidationFailure = { ok: false; path: string; rule: string; expected: unknown; actual: unknown };
type ValidationResult = { ok: true } | ValidationFailure;
type WorkspaceValidationResult = ({ ok: true; value: WorkspaceResponseV1; legacyUpgraded: boolean }) | ValidationFailure;`;
const edgeValidator = validatorSource
  .replace("function resolveRef(root, ref) {", "function resolveRef(root: JsonSchema, ref: string): JsonSchema {")
  .replace("function validateNode(value, node, root, pathName) {", "function validateNode(value: any, node: JsonSchema, root: JsonSchema, pathName: string): ValidationResult {")
  .replace("export function validateWorkspaceResponse(value, { allowLegacyV0 = false } = {}) {", "export function validateWorkspaceResponse(value: any, { allowLegacyV0 = false }: { allowLegacyV0?: boolean } = {}): WorkspaceValidationResult {")
  .replace("validateNode(value[key], child, root", "validateNode(value[key], child as JsonSchema, root")
  .replace("return result.ok ? { ok: true, value: normalized, legacyUpgraded } : result;", "return result.ok ? { ok: true, value: normalized as WorkspaceResponseV1, legacyUpgraded } : result;");
const edge = banner + defs + "\n\n" + edgeTypes + "\n\n" + edgeValidator;

async function emit(target, content) {
  if (CHECK) {
    const current = await readFile(target, "utf8").catch(() => "");
    if (current !== content) throw new Error(`generated workspace contract is stale: ${path.relative(ROOT, target)}`);
    return;
  }
  await writeFile(target, content, "utf8");
}

await emit(FRONTEND_TARGET, frontend);
await emit(EDGE_TARGET, edge);
console.log(CHECK ? "Workspace contract generated files are current." : `Generated Workspace Contract ${version}.`);

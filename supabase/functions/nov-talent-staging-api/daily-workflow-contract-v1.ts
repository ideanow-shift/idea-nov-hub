export const DAILY_WORKFLOW_CONTRACT_VERSION = "1.0.0";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function validateDailyWorkflowResponse(value: unknown): { ok: true; value: any } | { ok: false; path: string; rule: string } {
  const envelope = value as any;
  const data = envelope?.data;
  if (envelope?.ok !== true) return bad("ok", "const_true");
  if (data?.daily_workflow_contract_version !== DAILY_WORKFLOW_CONTRACT_VERSION) return bad("data.daily_workflow_contract_version", "version");
  if (!["COMPLETE", "PREPARING"].includes(data?.sourceCoverageState)) return bad("data.sourceCoverageState", "enum");
  if (!/^\d{4}-\d{2}-\d{2}T/u.test(String(data?.generatedAt || ""))) return bad("data.generatedAt", "timestamp");
  if (!Array.isArray(data?.communications) || !Array.isArray(data?.nextActions)) return bad("data", "arrays");
  if (data.sourceCoverageState === "PREPARING" && (data.communications.length || data.nextActions.length)) return bad("data", "preparing_must_be_empty");
  for (const [index, row] of data.communications.entries()) {
    if (!UUID.test(String(row?.id || "")) || !UUID.test(String(row?.candidateId || ""))
      || !/^\d{4}-\d{2}-\d{2}T/u.test(String(row?.occurredAt || "")) || !String(row?.summary || "").trim()
      || typeof row?.awaitingReply !== "boolean" || !Number.isInteger(row?.version) || row.version < 1) return bad(`data.communications.${index}`, "shape");
  }
  for (const [index, row] of data.nextActions.entries()) {
    if (!UUID.test(String(row?.id || "")) || !UUID.test(String(row?.candidateId || ""))
      || !["OPEN","ON_HOLD","COMPLETED","CANCELLED"].includes(row?.state)
      || typeof row?.isMine !== "boolean" || !Number.isInteger(row?.version) || row.version < 1) return bad(`data.nextActions.${index}`, "shape");
  }
  return { ok: true, value: envelope };
}

function bad(path: string, rule: string) { return { ok: false as const, path, rule }; }

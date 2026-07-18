const SUPPORTED_ACTIONS = new Set([
  "appendAnswerRule",
  "appendKnowledgeUpdate",
  "appendLog",
  "createDepartmentInquiry",
  "listAnswerRules",
  "listDepartmentInquiries",
  "listDepartmentRoutes",
  "listKnowledgeUpdates",
  "listLinks",
  "listLogs",
  "login",
  "login-store",
  "updateAnswerRule",
  "updateLink",
  "updateRating",
]);

export function resolveSupportedAction(payload: Record<string, unknown>, requestUrl: string): string | null {
  const payloadAction = typeof payload.action === "string" ? payload.action : "";
  const pathAction = new URL(requestUrl).pathname.split("/").pop() || "";
  const action = payloadAction || pathAction;
  return SUPPORTED_ACTIONS.has(action) ? action : null;
}

export function supportedActionCount(): number {
  return SUPPORTED_ACTIONS.size;
}

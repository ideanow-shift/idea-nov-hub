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
  const hasPayloadAction = Object.hasOwn(payload, "action");
  const payloadAction = typeof payload.action === "string" ? payload.action : "";
  const pathAction = new URL(requestUrl).pathname.split("/").pop() || "";
  const pathActionSupported = SUPPORTED_ACTIONS.has(pathAction);

  if (hasPayloadAction) {
    if (!SUPPORTED_ACTIONS.has(payloadAction)) return null;
    if (pathActionSupported && pathAction !== payloadAction) return null;
    return payloadAction;
  }

  return pathActionSupported ? pathAction : null;
}

export function supportedActionCount(): number {
  return SUPPORTED_ACTIONS.size;
}

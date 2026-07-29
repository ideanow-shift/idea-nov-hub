export class StagingApiError extends Error {
  constructor(code, message, status = 500) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export const errorResponse = (error, requestId) => ({
  status: Number(error?.status || 500),
  headers: { "content-type": "application/json", "cache-control": "no-store", "x-request-id": requestId },
  body: {
    error: {
      code: String(error?.code || "SERVER_ERROR"),
      message: Number(error?.status || 500) >= 500 ? "一時的に取得できません。" : String(error?.message || "Request failed."),
      request_id: requestId
    }
  }
});

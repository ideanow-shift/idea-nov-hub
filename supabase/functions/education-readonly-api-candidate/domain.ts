export type JsonRecord = Record<string, unknown>;

export type EducationReadAction =
  | "educationListMyAssignments"
  | "educationGetContentManifest"
  | "educationGetMyProgress";

export interface VerifiedHubSession {
  subject: string;
}

export interface EducationActor {
  id: string;
  isActive: boolean;
  loginEnabled: boolean;
  employmentStatus: string;
  retiredOn: string | null;
}

export interface EducationAssignmentRow {
  assignmentId: string;
  programTitle: string;
  status: "assigned" | "in_progress" | "completed" | "cancelled";
  dueAt: string | null;
  progressPercent: number;
}

export interface EducationContentManifest {
  assignmentId: string;
  programTitle: string;
  versionNumber: number;
  summary: string | null;
  contentKind: "video" | "manual" | "schedule" | "mixed";
  contentRef: string;
}

export interface EducationProgressRow {
  eventType:
    | "started"
    | "progress_saved"
    | "completed"
    | "reopened"
    | "corrected";
  progressPercent: number | null;
  occurredAt: string;
}

export interface EducationReadGateway {
  listAssignmentsForEmployee(
    employeeId: string,
  ): Promise<EducationAssignmentRow[]>;
  getContentForEmployee(
    employeeId: string,
    assignmentId: string,
  ): Promise<EducationContentManifest | null>;
  listProgressForEmployee(
    employeeId: string,
    assignmentId: string,
  ): Promise<EducationProgressRow[] | null>;
}

export interface EducationReadDependencies {
  verifyHubSession(token: string): Promise<VerifiedHubSession | null>;
  resolveActor(session: VerifiedHubSession): Promise<EducationActor | null>;
  gateway: EducationReadGateway;
  now?: () => Date;
}

export interface EducationReadRequest {
  action: string;
  token: string;
  payload?: JsonRecord;
}

export interface EducationReadResult {
  status: number;
  body: JsonRecord;
}

class EducationSafeError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTENT_REF_PATTERN = /^[a-z0-9][a-z0-9:_-]{0,127}$/i;
const INELIGIBLE_EMPLOYMENT =
  /\u9000\u8077|\u4f11\u8077|\u7523\u4f11|\u80b2\u4f11/;
const ASSIGNMENT_STATUSES = new Set([
  "assigned",
  "in_progress",
  "completed",
  "cancelled",
]);
const CONTENT_KINDS = new Set(["video", "manual", "schedule", "mixed"]);
const PROGRESS_EVENT_TYPES = new Set([
  "started",
  "progress_saved",
  "completed",
  "reopened",
  "corrected",
]);
const MAX_LIST_ROWS = 100;

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function isRetired(retiredOn: string | null, now: Date): boolean {
  if (!retiredOn) return false;
  const retiredTime = Date.parse(retiredOn);
  return Number.isFinite(retiredTime) && retiredTime <= now.getTime();
}

function boundedPercent(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function requireUuid(value: unknown): string {
  const normalized = text(value);
  if (!UUID_PATTERN.test(normalized)) {
    throw new Error("Invalid education identifier.");
  }
  return normalized;
}

function requireTimestamp(value: unknown): string {
  const normalized = text(value);
  const parsed = Date.parse(normalized);
  if (!normalized || !Number.isFinite(parsed)) {
    throw new Error("Invalid education timestamp.");
  }
  return new Date(parsed).toISOString();
}

function optionalTimestamp(value: unknown): string | null {
  return value === null || value === undefined || text(value) === ""
    ? null
    : requireTimestamp(value);
}

function safeAssignments(
  rows: EducationAssignmentRow[],
): EducationAssignmentRow[] {
  return rows.slice(0, MAX_LIST_ROWS).map((row) => {
    if (!ASSIGNMENT_STATUSES.has(row.status)) {
      throw new Error("Invalid education assignment status.");
    }
    return {
      assignmentId: requireUuid(row.assignmentId),
      programTitle: text(row.programTitle).slice(0, 160),
      status: row.status,
      dueAt: optionalTimestamp(row.dueAt),
      progressPercent: boundedPercent(row.progressPercent),
    };
  });
}

function safeContent(
  row: EducationContentManifest,
  expectedAssignmentId: string,
): EducationContentManifest {
  const assignmentId = requireUuid(row.assignmentId);
  if (assignmentId !== expectedAssignmentId) {
    throw new Error("Education assignment mismatch.");
  }
  const contentRef = text(row.contentRef);
  if (!CONTENT_REF_PATTERN.test(contentRef)) {
    throw new Error("Unsafe education content reference.");
  }
  const versionNumber = Number(row.versionNumber);
  if (!Number.isInteger(versionNumber) || versionNumber < 1) {
    throw new Error("Invalid education content version.");
  }
  if (!CONTENT_KINDS.has(row.contentKind)) {
    throw new Error("Invalid education content kind.");
  }
  return {
    assignmentId,
    programTitle: text(row.programTitle).slice(0, 160),
    versionNumber,
    summary: row.summary ? text(row.summary).slice(0, 500) : null,
    contentKind: row.contentKind,
    contentRef,
  };
}

function safeProgress(rows: EducationProgressRow[]): EducationProgressRow[] {
  return rows.slice(0, MAX_LIST_ROWS).map((row) => {
    if (!PROGRESS_EVENT_TYPES.has(row.eventType)) {
      throw new Error("Invalid education progress event.");
    }
    return {
      eventType: row.eventType,
      progressPercent: row.progressPercent === null
        ? null
        : boundedPercent(row.progressPercent),
      occurredAt: requireTimestamp(row.occurredAt),
    };
  });
}

function validatePayload(
  action: EducationReadAction,
  payload: JsonRecord,
): string | null {
  const allowed = action === "educationListMyAssignments"
    ? []
    : ["assignmentId"];
  const keys = Object.keys(payload);
  if (keys.some((key) => !allowed.includes(key))) {
    throw new EducationSafeError(
      400,
      "INVALID_REQUEST",
      "Unsupported request field.",
    );
  }
  if (action === "educationListMyAssignments") return null;
  const assignmentId = text(payload.assignmentId);
  if (!UUID_PATTERN.test(assignmentId)) {
    throw new EducationSafeError(
      400,
      "INVALID_REQUEST",
      "A valid assignment is required.",
    );
  }
  return assignmentId;
}

async function resolveEligibleActor(
  request: EducationReadRequest,
  deps: EducationReadDependencies,
): Promise<EducationActor> {
  const token = text(request.token);
  if (!token) {
    throw new EducationSafeError(
      401,
      "UNAUTHORIZED",
      "Authentication is required.",
    );
  }
  const session = await deps.verifyHubSession(token);
  if (!session || !text(session.subject)) {
    throw new EducationSafeError(401, "UNAUTHORIZED", "Authentication failed.");
  }
  const actor = await deps.resolveActor(session);
  const status = text(actor?.employmentStatus);
  if (
    !actor || !UUID_PATTERN.test(actor.id) || !actor.isActive ||
    !actor.loginEnabled
  ) {
    throw new EducationSafeError(
      403,
      "ACTOR_INELIGIBLE",
      "Education access is unavailable.",
    );
  }
  if (
    !status || INELIGIBLE_EMPLOYMENT.test(status) ||
    isRetired(actor.retiredOn, (deps.now ?? (() => new Date()))())
  ) {
    throw new EducationSafeError(
      403,
      "ACTOR_INELIGIBLE",
      "Education access is unavailable.",
    );
  }
  return actor;
}

export async function handleEducationRead(
  request: EducationReadRequest,
  deps: EducationReadDependencies,
): Promise<EducationReadResult> {
  try {
    const actions: EducationReadAction[] = [
      "educationListMyAssignments",
      "educationGetContentManifest",
      "educationGetMyProgress",
    ];
    if (!actions.includes(request.action as EducationReadAction)) {
      throw new EducationSafeError(
        404,
        "ACTION_NOT_FOUND",
        "Education action was not found.",
      );
    }
    const action = request.action as EducationReadAction;
    const payload = request.payload && typeof request.payload === "object" &&
        !Array.isArray(request.payload)
      ? request.payload
      : {};
    const assignmentId = validatePayload(action, payload);
    const actor = await resolveEligibleActor(request, deps);

    if (action === "educationListMyAssignments") {
      const rows = await deps.gateway.listAssignmentsForEmployee(actor.id);
      const items = safeAssignments(rows);
      return { status: 200, body: { ok: true, items, count: items.length } };
    }
    if (action === "educationGetContentManifest") {
      const item = await deps.gateway.getContentForEmployee(
        actor.id,
        assignmentId!,
      );
      if (!item) {
        throw new EducationSafeError(
          404,
          "NOT_FOUND",
          "Education content was not found.",
        );
      }
      return {
        status: 200,
        body: { ok: true, item: safeContent(item, assignmentId!) },
      };
    }
    const items = await deps.gateway.listProgressForEmployee(
      actor.id,
      assignmentId!,
    );
    if (!items) {
      throw new EducationSafeError(
        404,
        "NOT_FOUND",
        "Education progress was not found.",
      );
    }
    const safeItems = safeProgress(items);
    return {
      status: 200,
      body: { ok: true, items: safeItems, count: safeItems.length },
    };
  } catch (error) {
    if (error instanceof EducationSafeError) {
      return {
        status: error.status,
        body: { ok: false, code: error.code, message: error.message },
      };
    }
    return {
      status: 500,
      body: {
        ok: false,
        code: "INTERNAL_ERROR",
        message: "Education data could not be loaded.",
      },
    };
  }
}

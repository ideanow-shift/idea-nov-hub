import {
  type EducationActor,
  type EducationReadDependencies,
  type EducationReadGateway,
  handleEducationRead,
} from "../supabase/functions/education-readonly-api-candidate/domain.ts";

const ACTOR_ID = "10000000-0000-4000-8000-000000000001";
const ASSIGNMENT_ID = "20000000-0000-4000-8000-000000000001";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function actor(overrides: Partial<EducationActor> = {}): EducationActor {
  return {
    id: ACTOR_ID,
    isActive: true,
    loginEnabled: true,
    employmentStatus: "\u5728\u8077",
    retiredOn: null,
    ...overrides,
  };
}

function dependencies(
  options: { session?: boolean; actor?: EducationActor | null } = {},
): EducationReadDependencies & { calls: string[] } {
  const calls: string[] = [];
  const gateway: EducationReadGateway = {
    async listAssignmentsForEmployee(employeeId) {
      calls.push(`list:${employeeId}`);
      return [
        {
          assignmentId: ASSIGNMENT_ID,
          programTitle: "Synthetic program",
          status: "assigned",
          dueAt: null,
          progressPercent: 0,
          employee_email: "forbidden@example.invalid",
        } as never,
      ];
    },
    async getContentForEmployee(employeeId, assignmentId) {
      calls.push(`content:${employeeId}:${assignmentId}`);
      return assignmentId === ASSIGNMENT_ID
        ? {
          assignmentId,
          programTitle: "Synthetic program",
          versionNumber: 1,
          summary: null,
          contentKind: "manual",
          contentRef: "content-ref-1",
          storage_path: "forbidden/path",
          file_name: "forbidden.pdf",
        } as never
        : null;
    },
    async listProgressForEmployee(employeeId, assignmentId) {
      calls.push(`progress:${employeeId}:${assignmentId}`);
      return assignmentId === ASSIGNMENT_ID
        ? [
          {
            eventType: "started",
            progressPercent: 0,
            occurredAt: "2026-07-17T00:00:00Z",
            actor_employee_id: ACTOR_ID,
          } as never,
        ]
        : null;
    },
  };
  return {
    calls,
    verifyHubSession: async () =>
      options.session === false ? null : { subject: "server-subject" },
    resolveActor: async () =>
      options.actor === undefined ? actor() : options.actor,
    gateway,
    now: () => new Date("2026-07-17T00:00:00Z"),
  };
}

Deno.test("lists only server-resolved actor assignments", async () => {
  const deps = dependencies();
  const result = await handleEducationRead({
    action: "educationListMyAssignments",
    token: "fixture-token",
  }, deps);
  assert(
    result.status === 200 && result.body.count === 1,
    "list should succeed",
  );
  assert(deps.calls[0] === `list:${ACTOR_ID}`, "gateway must use server actor");
});

Deno.test("rejects missing and invalid sessions", async () => {
  const missing = await handleEducationRead({
    action: "educationListMyAssignments",
    token: "",
  }, dependencies());
  const invalid = await handleEducationRead({
    action: "educationListMyAssignments",
    token: "fixture",
    payload: {},
  }, dependencies({ session: false }));
  assert(
    missing.status === 401 && invalid.status === 401,
    "auth failures must be 401",
  );
});

Deno.test("fails closed for inactive login retired and leave actors", async () => {
  const actors = [
    actor({ isActive: false }),
    actor({ loginEnabled: false }),
    actor({ retiredOn: "2026-07-16" }),
    actor({ employmentStatus: "\u4f11\u8077\u4e2d" }),
    actor({ employmentStatus: "\u7523\u4f11\u30fb\u80b2\u4f11" }),
  ];
  for (const current of actors) {
    const result = await handleEducationRead({
      action: "educationListMyAssignments",
      token: "fixture",
    }, dependencies({ actor: current }));
    assert(
      result.status === 403 && result.body.code === "ACTOR_INELIGIBLE",
      "ineligible actor must be 403",
    );
  }
});

Deno.test("rejects payload actor role scope and unknown fields", async () => {
  for (
    const key of [
      "employeeId",
      "actor_employee_id",
      "roleKeys",
      "scope_type",
      "scope_id",
    ]
  ) {
    const result = await handleEducationRead({
      action: "educationListMyAssignments",
      token: "fixture",
      payload: { [key]: "override" },
    }, dependencies());
    assert(result.status === 400, `${key} must be rejected`);
  }
});

Deno.test("validates assignment and enforces actor-scoped gateway", async () => {
  const invalid = await handleEducationRead({
    action: "educationGetContentManifest",
    token: "fixture",
    payload: { assignmentId: "bad" },
  }, dependencies());
  const deps = dependencies();
  const found = await handleEducationRead({
    action: "educationGetContentManifest",
    token: "fixture",
    payload: { assignmentId: ASSIGNMENT_ID },
  }, deps);
  assert(invalid.status === 400, "invalid assignment must fail");
  assert(
    found.status === 200 &&
      deps.calls[0] === `content:${ACTOR_ID}:${ASSIGNMENT_ID}`,
    "content must be actor scoped",
  );
});

Deno.test("progress is actor scoped and write actions are absent", async () => {
  const deps = dependencies();
  const progress = await handleEducationRead({
    action: "educationGetMyProgress",
    token: "fixture",
    payload: { assignmentId: ASSIGNMENT_ID },
  }, deps);
  const write = await handleEducationRead({
    action: "educationCompleteAssignment",
    token: "fixture",
    payload: { assignmentId: ASSIGNMENT_ID },
  }, dependencies());
  assert(
    progress.status === 200 &&
      deps.calls[0] === `progress:${ACTOR_ID}:${ASSIGNMENT_ID}`,
    "progress must be actor scoped",
  );
  assert(
    write.status === 404 && write.body.code === "ACTION_NOT_FOUND",
    "write action must not exist",
  );
});

Deno.test("safe responses exclude employee and storage fields", async () => {
  const result = await handleEducationRead({
    action: "educationGetContentManifest",
    token: "fixture",
    payload: { assignmentId: ASSIGNMENT_ID },
  }, dependencies());
  const serialized = JSON.stringify(result.body);
  assert(
    !/employee|storage_path|signed|file_name|token|authorization/i.test(
      serialized,
    ),
    "forbidden response field",
  );
});

Deno.test("fails closed for malformed gateway assignment rows", async () => {
  for (
    const malformed of [
      { assignmentId: "bad" },
      { status: "unknown" },
      { dueAt: "not-a-date" },
    ]
  ) {
    const deps = dependencies();
    deps.gateway.listAssignmentsForEmployee = async () =>
      [{
        assignmentId: ASSIGNMENT_ID,
        programTitle: "Synthetic program",
        status: "assigned",
        dueAt: null,
        progressPercent: 0,
        ...malformed,
      }] as never;
    const result = await handleEducationRead({
      action: "educationListMyAssignments",
      token: "fixture",
    }, deps);
    assert(
      result.status === 500 && result.body.code === "INTERNAL_ERROR",
      "malformed assignment row must fail closed",
    );
  }
});

Deno.test("fails closed for unsafe content and progress rows", async () => {
  const contentDeps = dependencies();
  contentDeps.gateway.getContentForEmployee = async () => ({
    assignmentId: ASSIGNMENT_ID,
    programTitle: "Synthetic program",
    versionNumber: 1,
    summary: null,
    contentKind: "manual",
    contentRef: "https://forbidden.invalid/file",
  });
  const content = await handleEducationRead({
    action: "educationGetContentManifest",
    token: "fixture",
    payload: { assignmentId: ASSIGNMENT_ID },
  }, contentDeps);
  assert(content.status === 500, "unsafe content reference must fail closed");

  const progressDeps = dependencies();
  progressDeps.gateway.listProgressForEmployee = async () => [{
    eventType: "started",
    progressPercent: 0,
    occurredAt: "not-a-date",
  }];
  const progress = await handleEducationRead({
    action: "educationGetMyProgress",
    token: "fixture",
    payload: { assignmentId: ASSIGNMENT_ID },
  }, progressDeps);
  assert(progress.status === 500, "invalid progress row must fail closed");
});

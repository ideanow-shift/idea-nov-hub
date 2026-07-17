import type {
  EducationActor,
  EducationReadGateway,
} from "../supabase/functions/education-readonly-api-candidate/domain.ts";
import {
  type EducationHttpDependencies,
  handleEducationHttpRequest,
} from "../supabase/functions/education-readonly-api-candidate/http.ts";

const ORIGIN = "https://hub.example.invalid";
const ACTOR_ID = "10000000-0000-4000-8000-000000000001";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function dependencies(): EducationHttpDependencies & { calls: string[] } {
  const calls: string[] = [];
  const gateway: EducationReadGateway = {
    listAssignmentsForEmployee: async (employeeId) => {
      calls.push(`list:${employeeId}`);
      return [];
    },
    getContentForEmployee: async () => null,
    listProgressForEmployee: async () => null,
  };
  const actor: EducationActor = {
    id: ACTOR_ID,
    isActive: true,
    loginEnabled: true,
    employmentStatus: "\u5728\u8077",
    retiredOn: null,
  };
  return {
    calls,
    isAllowedOrigin: (origin) => origin === ORIGIN,
    verifyHubSession: async (token) =>
      token === "fixture-token" ? { subject: "fixture-subject" } : null,
    resolveActor: async () => actor,
    gateway,
  };
}

function request(
  body: unknown,
  options: { origin?: string; token?: string; method?: string } = {},
): Request {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Origin": options.origin ?? ORIGIN,
  });
  if (options.token !== "") {
    headers.set("Authorization", `Bearer ${options.token ?? "fixture-token"}`);
  }
  return new Request("https://edge.example.invalid/education-readonly-api", {
    method: options.method ?? "POST",
    headers,
    body: options.method === "OPTIONS" ? undefined : JSON.stringify(body),
  });
}

async function safeBody(response: Response): Promise<Record<string, unknown>> {
  return await response.json();
}

Deno.test("allows preflight only for an approved origin", async () => {
  const allowed = await handleEducationHttpRequest(
    request({}, { method: "OPTIONS" }),
    dependencies(),
  );
  const denied = await handleEducationHttpRequest(
    request({}, { method: "OPTIONS", origin: "https://evil.invalid" }),
    dependencies(),
  );
  assert(allowed.status === 204, "approved preflight must succeed");
  assert(denied.status === 403, "unknown origin must fail");
});

Deno.test("requires bearer authentication", async () => {
  const response = await handleEducationHttpRequest(
    request({ action: "educationListMyAssignments" }, { token: "" }),
    dependencies(),
  );
  assert(response.status === 401, "missing bearer must be 401");

  const oversizedBearer = await handleEducationHttpRequest(
    request({ action: "educationListMyAssignments" }, {
      token: "x".repeat(5000),
    }),
    dependencies(),
  );
  assert(oversizedBearer.status === 401, "oversized bearer must be 401");
});

Deno.test("requires JSON content type", async () => {
  const value = request({ action: "educationListMyAssignments" });
  value.headers.set("Content-Type", "text/plain");
  const response = await handleEducationHttpRequest(value, dependencies());
  assert(response.status === 415, "non-JSON request must be rejected");
});

Deno.test("routes one read action with server-resolved actor", async () => {
  const deps = dependencies();
  const response = await handleEducationHttpRequest(
    request({ action: "educationListMyAssignments" }),
    deps,
  );
  const body = await safeBody(response);
  assert(response.status === 200 && body.ok === true, "read must succeed");
  assert(deps.calls[0] === `list:${ACTOR_ID}`, "read must be actor scoped");
  assert(
    response.headers.get("Cache-Control") === "no-store",
    "responses must not be cached",
  );
});

Deno.test("rejects token actor role and scope in the body", async () => {
  for (const key of ["token", "employeeId", "actor", "roleKeys", "scope"]) {
    const response = await handleEducationHttpRequest(
      request({ action: "educationListMyAssignments", [key]: "forbidden" }),
      dependencies(),
    );
    assert(response.status === 400, `${key} must be rejected`);
  }
});

Deno.test("rejects malformed JSON and oversized bodies", async () => {
  const malformed = new Request(
    "https://edge.example.invalid/education-readonly-api",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer fixture-token",
        "Content-Type": "application/json",
        Origin: ORIGIN,
      },
      body: "{",
    },
  );
  const malformedResponse = await handleEducationHttpRequest(
    malformed,
    dependencies(),
  );
  const oversizedResponse = await handleEducationHttpRequest(
    request({
      action: "educationListMyAssignments",
      padding: "x".repeat(17 * 1024),
    }),
    dependencies(),
  );
  assert(malformedResponse.status === 400, "malformed JSON must fail");
  assert(oversizedResponse.status === 413, "oversized body must fail");
});

Deno.test("keeps write actions absent", async () => {
  const response = await handleEducationHttpRequest(
    request({ action: "educationCompleteAssignment" }),
    dependencies(),
  );
  const body = await safeBody(response);
  assert(
    response.status === 404 && body.code === "ACTION_NOT_FOUND",
    "write action must remain absent",
  );
});

Deno.test("safe result exposes no token or identity values", async () => {
  const response = await handleEducationHttpRequest(
    request({ action: "educationListMyAssignments" }),
    dependencies(),
  );
  const serialized = JSON.stringify(await safeBody(response));
  assert(
    !/fixture-token|authorization|employee|actor|role|scope/i.test(serialized),
    "forbidden value reached response",
  );
});

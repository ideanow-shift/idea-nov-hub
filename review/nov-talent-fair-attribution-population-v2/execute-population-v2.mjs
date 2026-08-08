import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { canonicalPayloadHash, sourceRangeHash } from "./source-hash-contract.mjs";

const CONTRACT_URL = new URL("../../docs/nov_talent/fair_attribution_population_v2/executor-contract-v2.json", import.meta.url);

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function fail(message) {
  console.error(JSON.stringify({ ok: false, safeCode: message }));
  process.exitCode = 1;
}

async function main() {
  const manifestPath = arg("--manifest");
  const sourceValuesPath = arg("--source-values");
  const execute = process.argv.includes("--execute");
  if (!manifestPath || !sourceValuesPath) return fail("PRIVATE_INPUT_PATH_REQUIRED");

  const contract = JSON.parse(await readFile(CONTRACT_URL, "utf8"));
  const manifestBytes = await readFile(manifestPath);
  const manifestJson = manifestBytes.toString("utf8");
  if (sha256Bytes(manifestBytes) !== contract.manifest_file_sha256) return fail("MANIFEST_FILE_HASH_MISMATCH");
  const manifest = JSON.parse(manifestJson);
  const embeddedCanonicalHash = manifest.manifest_canonical_payload_sha256;
  delete manifest.manifest_canonical_payload_sha256;
  const computedCanonicalHash = canonicalPayloadHash(manifest);
  manifest.manifest_canonical_payload_sha256 = embeddedCanonicalHash;
  if (embeddedCanonicalHash !== contract.manifest_canonical_payload_sha256 || computedCanonicalHash !== embeddedCanonicalHash) {
    return fail("MANIFEST_CANONICAL_HASH_MISMATCH");
  }

  const sourceValues = JSON.parse(await readFile(sourceValuesPath, "utf8"));
  if (!Array.isArray(sourceValues) || sourceRangeHash(sourceValues) !== contract.source_range_sha256) {
    return fail("SOURCE_RANGE_HASH_MISMATCH");
  }

  const cases = Array.isArray(manifest.cases) ? manifest.cases : [];
  const physicalRows = cases.reduce((sum, item) => sum + (Array.isArray(item.fair_candidate_ids) ? item.fair_candidate_ids.length : 0), 0);
  if (cases.length !== contract.logical_candidate_count || physicalRows !== contract.physical_pending_row_count) {
    return fail("POPULATION_COUNT_MISMATCH");
  }

  if (!execute) {
    console.log(JSON.stringify({
      ok: true,
      mode: "validation-only",
      environment: contract.environment,
      logicalCandidateCount: cases.length,
      physicalPendingRowCount: physicalRows,
      manifestCanonicalPayloadSha256: computedCanonicalHash,
      sourceRangeSha256: contract.source_range_sha256,
      executed: false,
    }));
    return;
  }

  const hubToken = process.env.NOV_HUB_SESSION_TOKEN || "";
  const ownerApproval = process.env.NOV_TALENT_FAIR_ATTRIBUTION_POPULATION_V2_OWNER_APPROVAL || "";
  if (hubToken.length < 16 || ownerApproval.length < 32) return fail("SESSION_OR_OWNER_APPROVAL_REQUIRED");

  // Exactly one HTTP call. There is intentionally no retry loop.
  const response = await fetch(contract.endpoint, {
    method: "POST",
    redirect: "error",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${hubToken}`,
      "content-type": "application/json",
      origin: "https://ideanow-shift.github.io",
      "x-nov-talent-owner-approval": ownerApproval,
    },
    body: JSON.stringify({ manifestJson, sourceRangeValues: sourceValues }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) return fail(String(body?.safeCode || `HTTP_${response.status}`));
  if (response.status !== 201 || body?.data?.attributionCount !== 201 || body?.data?.auditCount !== 201
    || body?.data?.status !== "PENDING" || body?.data?.manifestCanonicalPayloadSha256 !== contract.manifest_canonical_payload_sha256) {
    return fail("EXECUTOR_RESPONSE_CONTRACT_INVALID");
  }
  console.log(JSON.stringify({
    ok: true,
    mode: "executed",
    environment: contract.environment,
    attributionCount: body.data.attributionCount,
    auditCount: body.data.auditCount,
    status: body.data.status,
  }));
}

await main().catch(() => fail("EXECUTOR_UNEXPECTED_FAILURE"));

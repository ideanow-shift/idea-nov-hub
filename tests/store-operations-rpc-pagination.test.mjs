import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  readAllStoreMonthlyActualRpcPages,
  STORE_MONTHLY_ACTUAL_RANGE_RPC,
  STORE_MONTHLY_ACTUAL_RPC_PAGE_SIZE,
} from "../supabase/functions/nov-hub-api/store_operations_rpc_pagination.mjs";

const edge = readFileSync(new URL(
  "../supabase/functions/nov-hub-api/index.ts",
  import.meta.url,
), "utf8");
const bundleManifest = JSON.parse(readFileSync(new URL(
  "../docs/store_operations_management/production_integration/store-operations-status-budget-staging-edge-bundle-v1.json",
  import.meta.url,
), "utf8"));

function rows(count) {
  return Array.from({ length: count }, (_, index) => ({
    ordinal: index,
    fiscal_month: index < count - 117 ? "2026-06-01" : "2026-07-01",
  }));
}

test("24-month actual RPC returns every row beyond the 1,000-row response limit", async () => {
  const fixture = rows(2645);
  const requests = [];
  const result = await readAllStoreMonthlyActualRpcPages({
    rpcName: STORE_MONTHLY_ACTUAL_RANGE_RPC,
    payload: { p_start_month: "2024-08-01", p_end_month: "2026-07-01" },
    requestPage: async ({ limit, offset }) => {
      requests.push({ limit, offset });
      return fixture.slice(offset, offset + limit);
    },
  });

  assert.equal(STORE_MONTHLY_ACTUAL_RPC_PAGE_SIZE, 1000);
  assert.deepEqual(requests, [
    { limit: 1000, offset: 0 },
    { limit: 1000, offset: 1000 },
    { limit: 1000, offset: 2000 },
  ]);
  assert.equal(result.length, 2645);
  assert.deepEqual(result.map((row) => row.ordinal), fixture.map((row) => row.ordinal));
  assert.equal(result.filter((row) => row.fiscal_month === "2026-07-01").length, 117);
});

test("exact page boundaries request one final empty page without duplicating rows", async () => {
  const fixture = rows(2000);
  const offsets = [];
  const result = await readAllStoreMonthlyActualRpcPages({
    rpcName: STORE_MONTHLY_ACTUAL_RANGE_RPC,
    payload: {},
    requestPage: async ({ limit, offset }) => {
      offsets.push(offset);
      return fixture.slice(offset, offset + limit);
    },
  });
  assert.deepEqual(offsets, [0, 1000, 2000]);
  assert.deepEqual(result, fixture);
});

test("pagination fails closed for every RPC except the monthly actual range RPC", async () => {
  let requested = false;
  await assert.rejects(
    readAllStoreMonthlyActualRpcPages({
      rpcName: "dbf_store_monthly_budget_range_read_v1",
      payload: {},
      requestPage: async () => {
        requested = true;
        return [];
      },
    }),
    /STORE_MONTHLY_ACTUAL_RPC_NOT_ALLOWED/u,
  );
  assert.equal(requested, false);
});

test("malformed or unbounded responses fail closed", async () => {
  await assert.rejects(
    readAllStoreMonthlyActualRpcPages({
      rpcName: STORE_MONTHLY_ACTUAL_RANGE_RPC,
      payload: {},
      requestPage: async () => ({ rows: [] }),
    }),
    /STORE_MONTHLY_ACTUAL_RPC_PAGE_INVALID/u,
  );
  await assert.rejects(
    readAllStoreMonthlyActualRpcPages({
      rpcName: STORE_MONTHLY_ACTUAL_RANGE_RPC,
      payload: {},
      pageSize: 2,
      maxPages: 2,
      requestPage: async () => [{}, {}],
    }),
    /STORE_MONTHLY_ACTUAL_RPC_PAGE_LIMIT_EXCEEDED/u,
  );
});

test("Edge adapter pages only the approved actual RPC with limit and offset", () => {
  assert.match(edge, /name === STORE_MONTHLY_ACTUAL_RANGE_RPC/u);
  assert.match(edge, /query: \{ limit, offset \}/u);
  assert.match(edge, /readAllStoreMonthlyActualRpcPages/u);
  assert.equal((edge.match(/name === STORE_MONTHLY_ACTUAL_RANGE_RPC/gu) || []).length, 1);
});

test("status and budget Staging Edge bundle preserves pagination and pins the complete Deno dependency graph", () => {
  assert.equal(bundleManifest.deployment_status, "NOT_DEPLOYED");
  assert.equal(bundleManifest.project_ref, "zgkoofphhivesclehrom");
  assert.equal(bundleManifest.bundle_file_count, 17);
  assert.equal(bundleManifest.files.length, 17);
  const sorted = [...bundleManifest.files].sort((left, right) => left.path.localeCompare(right.path));
  const input = sorted.map((file) => `${file.path}\t${file.sha256}\t${file.bytes}`).join("\n");
  assert.equal(createHash("sha256").update(input).digest("hex"), bundleManifest.bundle_content_sha256);
  for (const file of sorted) {
    const content = readFileSync(new URL(`../${file.path}`, import.meta.url));
    assert.equal(content.byteLength, file.bytes, file.path);
    assert.equal(createHash("sha256").update(content).digest("hex"), file.sha256, file.path);
  }
});

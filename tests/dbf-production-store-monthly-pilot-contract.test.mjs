import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const edge = await readFile("supabase/functions/dbf-business-data-api/index.ts", "utf8");
const pilot = await readFile("supabase/functions/dbf-business-data-api/production-pilot.ts", "utf8");
const hub = await readFile("supabase/functions/nov-hub-api/index.ts", "utf8");
const migration = await readFile(
  "supabase/migrations/20260909204237_dbf_production_store_monthly_pilot_v1.sql",
  "utf8",
);

test("Production Edge boundary is exact and defaults to writes disabled", () => {
  assert.match(pilot, /OWNER_APPROVED_STORE_MONTHLY_PILOT_V1/u);
  assert.match(edge, /runtime\.productionWrite !== PRODUCTION_PILOT_GATE/u);
  assert.match(edge, /Deno\.env\.get\("DBF_PRODUCTION_WRITE"\) \|\| "DISABLED"/u);
  assert.match(edge, /target === "production" \? "hub_session" : "dbf_staging_session"/u);
  assert.match(edge, /dbf_import_store_monthly_pilot_(start|stage|approve|promote)_v1/u);
});

test("Pilot contract binds exactly three files, two stores, and no synthetic zero", () => {
  assert.match(pilot, /2025-06-pilot-store-actual\.csv/u);
  assert.match(pilot, /2026-06-pilot-store-actual\.csv/u);
  assert.match(pilot, /2026-06-pilot-store-budget\.csv/u);
  assert.equal((pilot.match(/fileName: "/gu) || []).length, 3);
  assert.match(pilot, /BASSA池袋店/u);
  assert.match(pilot, /BASSA上石神井店/u);
  assert.doesNotMatch(pilot, /value:\s*0(?:\D|$)/u);
  assert.doesNotMatch(pilot, /amount:\s*0(?:\D|$)/u);
});

test("NOV HUB supports Production HUB session without weakening capability authorization", () => {
  assert.match(hub, /new Set\(\["dbf_staging_session", "hub_session"\]\)\.has\(authType\)/u);
  assert.match(hub, /resolveDbfHandoffBusinessDataAdmin/u);
  assert.match(hub, /if \(!authorization\.businessDataAdmin\)/u);
});

test("Database wrapper is service-role-only, append-audited, and idempotent", () => {
  for (const suffix of ["preflight", "start", "stage", "approve", "promote"]) {
    assert.match(migration, new RegExp(`dbf_import_store_monthly_pilot_${suffix}_v1`, "u"));
  }
  assert.match(migration, /from public, anon, authenticated/gu);
  assert.match(migration, /to service_role/gu);
  assert.match(migration, /pg_advisory_xact_lock/u);
  assert.match(migration, /PRODUCTION_PILOT_SOURCE_BOUND/u);
  assert.match(migration, /PRODUCTION_PILOT_VALIDATION_BOUND/u);
  assert.match(migration, /PRODUCTION_PILOT_OWNER_APPROVED/u);
  assert.match(migration, /PRODUCTION_PILOT_PROMOTED/u);
  assert.match(migration, /'idempotent', true/u);
  assert.match(migration, /'1bcba30a-d063-4cdb-be74-425e250aeb25'/u);
  assert.match(migration, /'36c222de-0554-4265-b177-3b68285cc4a4'/u);
});

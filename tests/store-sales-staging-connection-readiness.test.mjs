import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const existingEnvironment = await readFile(resolve(root, "supabase/functions/store-sales-projection/environment.js"), "utf8");
const existingService = await readFile(resolve(root, "supabase/functions/store-sales-projection/service.js"), "utf8");
const report = await readFile(resolve(root, "docs/store_sales_management/staging_connection/staging-connection-report.md"), "utf8");
const runtime = await readFile(resolve(root, "docs/store_sales_management/staging_connection/runtime-report.md"), "utf8");
const goNoGo = await readFile(resolve(root, "docs/store_sales_management/staging_connection/go-no-go.md"), "utf8");

assert.match(existingEnvironment, /STAGING_SYNTHETIC_REQUIRED/);
assert.match(existingService, /SYNTHETIC_STORES/);
assert.match(report, /BLOCKED/);
assert.match(runtime, /NOT CONNECTED/);
assert.match(goNoGo, /Decision: NO-GO/);
assert.doesNotMatch(`${report}\n${runtime}\n${goNoGo}`, /postgres(?:ql)?:\/\/[^\s]+/i);
process.stdout.write("RESULT staging real-data connection is blocked until verified Staging ports exist PASS\n");

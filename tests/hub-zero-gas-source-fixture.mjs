import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"));
const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
const runtimeFiles = tracked.filter((file) => file.startsWith("portal/") || file.startsWith("supabase/functions/"));
const forbiddenRuntime = /script\.google\.com|google\.script\.run|IDEA_LINK_LEGACY_DEPLOYMENT_ID|GAS_API_URL|gasApiUrl/i;
const runtimeHits = [];

for (const file of runtimeFiles) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) continue;
  const content = fs.readFileSync(fullPath, "utf8");
  if (forbiddenRuntime.test(content)) runtimeHits.push(file);
}

const gasSource = tracked.filter((file) => file.startsWith("gas-backend/") || /\.gs$/i.test(file));
assert.deepEqual(runtimeHits, [], `runtime GAS references: ${runtimeHits.join(", ")}`);
assert.deepEqual(gasSource, [], `tracked GAS sources: ${gasSource.join(", ")}`);
console.log("hub-zero-gas-source-fixture: PASS runtime=0 source=0");

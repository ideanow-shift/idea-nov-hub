import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "build/dbf-staging-pages");
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
fs.cpSync(path.join(root, "portal/management-app"), path.join(output, "management-app"), { recursive: true });
fs.cpSync(path.join(root, "portal/js"), path.join(output, "js"), { recursive: true });
fs.copyFileSync(path.join(root, "deploy/dbf-staging/firebase-config.js"), path.join(output, "js/firebase-config.js"));
fs.copyFileSync(path.join(root, "deploy/dbf-staging/runtime.js"), path.join(output, "dbf-staging-runtime.js"));

const managementIndex = path.join(output, "management-app/index.html");
const html = fs.readFileSync(managementIndex, "utf8");
const marker = '<script type="module" src="./app-v2.js';
if (!html.includes(marker)) throw new Error("Management application entrypoint not found.");
fs.writeFileSync(managementIndex, html.replace(marker, '<script src="../dbf-staging-runtime.js"></script>\n  ' + marker), "utf8");
fs.writeFileSync(path.join(output, "index.html"), '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=./management-app/#businessdata"><title>DBF STAGING</title>', "utf8");

const builtConfig = fs.readFileSync(path.join(output, "js/firebase-config.js"), "utf8");
const forbiddenProjectRef = ["nkmxevmioczc", "mnldreyo"].join("");
if (!builtConfig.includes("zgkoofphhivesclehrom") || builtConfig.includes(`https://${forbiddenProjectRef}.supabase.co`)) {
  throw new Error("Staging build contains an invalid Supabase target.");
}
process.stdout.write(`${JSON.stringify({ output, environment: "staging", projectRef: "zgkoofphhivesclehrom", productionWrite: 0 })}\n`);
